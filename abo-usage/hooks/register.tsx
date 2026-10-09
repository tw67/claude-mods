import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Credits, Limit } from '../types'

const limits = atom({ plugin: 'abo-usage', key: 'limits' } as const, [])
const now = atom({ plugin: 'abo-usage', key: 'now' } as const, 0)
const credits = atom({ plugin: 'abo-usage', key: 'credits' } as const, null)

const BAR_WIDTH = 20
const LABEL_WIDTH = 14
const PERCENT_WIDTH = 6

const LABELS: Record<string, string> = {
  five_hour: '5h-Limit',
  seven_day: 'Wochenlimit',
  spend_limit: 'Ausgabenlimit',
}

export function colorFor(percent: number): string {
  if (percent <= 30) return 'green'
  if (percent <= 80) return 'white'
  return 'red'
}

export function clamp(percent: number): number {
  return Math.min(Math.max(percent, 0), 100)
}

export function filledCells(percent: number): number {
  return Math.round((clamp(percent) / 100) * BAR_WIDTH)
}

export function bar(percent: number): string {
  const filled = filledCells(percent)
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function resetText(resetsAt: string | undefined, nowMs: number): string {
  if (!resetsAt) return ''
  const at = new Date(resetsAt)
  const ms = at.getTime() - nowMs
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'Reset steht an'

  const mins = Math.ceil(ms / 60000)
  const d = Math.floor(mins / 1440)
  const h = Math.floor((mins % 1440) / 60)
  const m = mins % 60
  const rel = d > 0 ? `${d}T ${h}h` : h > 0 ? `${h}h ${pad(m)}m` : `${m}m`
  const clock = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const when = d > 0 ? `${pad(at.getDate())}.${pad(at.getMonth() + 1)}. ${clock}` : clock

  return `Reset in ${rel} (${when})`
}

async function store($: EngineInterface, next: Limit[]) {
  await update($, limits, () => next.map(l => ({ kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt })))
  const t = await $.clock.now()
  await update($, now, () => t)
}

export function parseBalance(text: string | undefined): Credits | null {
  if (!text) return null
  try {
    const data = JSON.parse(text) as { credits?: unknown; subscription_plan_type?: unknown }
    if (typeof data.credits !== 'number') return null
    const plan = typeof data.subscription_plan_type === 'string' ? data.subscription_plan_type : undefined
    return { credits: data.credits, plan }
  } catch {
    return null
  }
}

function planName(plan: string | undefined): string {
  return plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : ''
}

// Das Higgsfield-Tool heißt mcp__<connector-id>__balance; die ID wird zur Laufzeit gesucht.
async function refreshCredits($: EngineInterface) {
  const tools = await $.tool.list()
  const balance = tools.find(t => t.mcp && t.name.endsWith('__balance') && /credits/i.test(t.description))
  if (!balance) return

  // Nur abfragen, wenn das ohne Rückfrage erlaubt ist – sonst würde jede Abfrage einen Dialog öffnen.
  const { decision } = await $.tool.check({ tool: balance.name, input: {} })
  if (decision !== 'allow') return

  const r = await $.tool.call({ tool: balance.name as `mcp__${string}__${string}` })
  if ('deny' in r && r.deny) return
  if (r.isError) return
  const parsed = parseBalance(r.text)
  if (parsed) await update($, credits, () => parsed)
}

let isRefreshing = false

function refresh($: EngineInterface) {
  if (isRefreshing) return
  isRefreshing = true
  void refreshCredits($)
    .catch(() => undefined)
    .finally(() => {
      isRefreshing = false
    })
}

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    const usage = await $.session.usage()
    await store($, usage.rateLimits)
    // Countdown jede Minute auffrischen
    $.clock.every(60_000, () => {
      void $.clock.now().then(t => update($, now, () => t))
    })
    // Higgsfield-Credits beim Start und alle 5 Minuten
    refresh($)
    $.clock.every(5 * 60_000, () => refresh($))
    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await store($, e.rateLimits)
    return next(e)
  })

  // Nach jeder Antwort neu abfragen – dort könnten Credits verbraucht worden sein
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    refresh($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, limits)
    const balance = await read($, credits)
    if (e.props.hasSurvey || (list.length === 0 && balance === null)) return next(e)

    const nowMs = await read($, now)
    const { Box, Text } = $.ui.resolve(e)
    const isTerminal = e.surface === 'terminal'
    const barColumn = isTerminal ? BAR_WIDTH : BAR_WIDTH + 2

    return (
      <Box flexDirection="column">
        {list.map(l => {
          const color = colorFor(l.percentUsed)
          const label = LABELS[l.kind] ?? l.kind
          return (
            <Box key={l.kind}>
              <Box width={LABEL_WIDTH} flexShrink={0}>
                <Text dimColor>{label}</Text>
              </Box>
              {isTerminal ? (
                <Box width={BAR_WIDTH} flexShrink={0}>
                  <Text color={color}>{bar(l.percentUsed)}</Text>
                </Box>
              ) : (
                // Desktop: Fläche statt Blockzeichen, damit die Breite nicht vom Font abhängt.
                // Begrenzung links/rechts statt Rahmen: braucht keine zusätzlichen Zeilen.
                <Box key={`${l.kind}-bar`} width={BAR_WIDTH + 2} height={1} flexShrink={0}>
                  <Box width={1} flexShrink={0}>
                    <Text dimColor>▕</Text>
                  </Box>
                  <Box width={BAR_WIDTH} height={1} flexShrink={0} flexDirection="row" overflow="hidden">
                    {filledCells(l.percentUsed) > 0 && (
                      <Box width={filledCells(l.percentUsed)} height={1} flexShrink={0} backgroundColor={color} />
                    )}
                  </Box>
                  <Box width={1} flexShrink={0}>
                    <Text dimColor>▏</Text>
                  </Box>
                </Box>
              )}
              <Box width={PERCENT_WIDTH} flexShrink={0} justifyContent="flex-end">
                <Text color={color} bold>{`${Math.round(l.percentUsed)}%`}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text dimColor>{resetText(l.resetsAt, nowMs)}</Text>
              </Box>
            </Box>
          )
        })}
        {balance !== null && (
          <Box key="higgsfield">
            <Box width={LABEL_WIDTH} flexShrink={0}>
              <Text dimColor>Higgsfield</Text>
            </Box>
            {/* gleiche Spalten wie die Balken-Zeilen: Credits unter dem Balken, Tarif unter dem Reset */}
            <Box width={barColumn + PERCENT_WIDTH} flexShrink={0} paddingLeft={isTerminal ? 0 : 1}>
              <Text bold>{`${balance.credits.toFixed(2)} Credits`}</Text>
            </Box>
            {balance.plan && (
              <Box marginLeft={2}>
                <Text dimColor>{planName(balance.plan)}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    )
  })
}

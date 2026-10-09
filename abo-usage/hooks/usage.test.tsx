import { describe, expect, mock, test } from 'claude-code/testing'

import { bar, colorFor, parseBalance, resetText } from './register'

const BAND = {
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
}

describe('Farben', () => {
  test('0-30 grün, 31-80 weiß, 81-100 rot', async () => {
    expect(colorFor(0)).toBe('green')
    expect(colorFor(30)).toBe('green')
    expect(colorFor(31)).toBe('white')
    expect(colorFor(80)).toBe('white')
    expect(colorFor(81)).toBe('red')
    expect(colorFor(100)).toBe('red')
  })

  test('Balken', async () => {
    expect(bar(50)).toBe('█'.repeat(10) + '░'.repeat(10))
    expect(bar(150)).toBe('█'.repeat(20))
  })

  test('Reset-Text', async () => {
    const now = Date.parse('2026-10-09T10:00:00Z')
    expect(resetText('2026-10-09T12:15:00Z', now)).toMatch(/^Reset in 2h 15m \(\d\d:\d\d\)$/)
    expect(resetText('2026-10-11T10:00:00Z', now)).toMatch(/^Reset in 2T 0h/)
    expect(resetText(undefined, now)).toBe('')
  })
})

test('Leiste zeigt die Limits nach einer Messung', async ($, on) => {
  mock.clock(on, { now: Date.parse('2098-12-31T22:00:00Z') })
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  await $.session.measure({
    context: { window: 200000 } as never,
    rateLimits: [
      { kind: 'five_hour', percentUsed: 12, resetsAt: '2099-01-01T00:00:00Z' },
      { kind: 'seven_day', percentUsed: 92.4 },
    ],
    changed: ['rateLimits'],
  })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'abo-usage', surface, ...BAND })
    const five = await ui.find({ type: 'Text', text: /12%/ })
    expect(five?.props.color).toBe('green')
    const week = await ui.find({ type: 'Text', text: /92%/ })
    expect(week?.props.color).toBe('red')
    expect(await ui.find({ type: 'Text', text: /Reset in 2h 00m/ })).toBeDefined()
    if (surface === 'desktop') {
      // Balken stehen gleich breit untereinander, Reset-Text außerhalb
      for (const kind of ['five_hour', 'seven_day']) {
        const b = await ui.find({ key: `${kind}-bar` })
        expect(b?.props.width).toBe(22)
        expect(b?.props.height).toBe(1)
        expect(b?.props.borderStyle).toBeUndefined()
        expect(b?.props.backgroundColor).toBeUndefined()
      }
    }
    await ui.unmount()
  }
})

test('Higgsfield-Antwort wird gelesen', async () => {
  expect(parseBalance('{"credits":23.05,"subscription_plan_type":"starter"}')).toEqual({ credits: 23.05, plan: 'starter' })
  expect(parseBalance('kein json')).toBeNull()
  expect(parseBalance(undefined)).toBeNull()
})

test('Higgsfield-Credits erscheinen in der Leiste', async ($, on) => {
  const clock = mock.clock(on, { now: 0 })
  const TOOL = 'mcp__abc__balance'
  on('session.start', () => ({ cwd: '/tmp' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 1 }, rateLimits: [] } }) as never)
  on('tool.list', () => ({ value: [{ name: TOOL, description: 'Get the available credits', mcp: true }] }) as never)
  const seen: string[] = []
  on('tool.check', () => (seen.push('check'), { decision: 'allow' }) as never)
  on('tool.call', { tool: TOOL }, () => (seen.push('call'), { result: {}, text: '{"credits":23.05,"subscription_plan_type":"starter"}' }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(seen).toEqual(['check', 'call'])
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'abo-usage', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /23\.05 Credits/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Starter$/ })).toBeDefined()
    await ui.unmount()
  }
})

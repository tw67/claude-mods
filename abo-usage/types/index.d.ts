export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Credits = { credits: number; plan?: string }

declare module 'claude-code' {
  interface PluginState {
    'abo-usage': { limits: Limit[]; now: number; credits: Credits | null }
  }
}

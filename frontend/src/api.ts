import { fields } from './i18n'

export type Incident = Record<keyof typeof fields, string>
export const blankIncident = Object.fromEntries(Object.keys(fields).map(key => [key, ''])) as Incident
export type Finding = { id: string; category: string; severity: string; evidence: string }
export type LinkCheck = { domain: string; registrable_domain: string; findings: Finding[]; reputation: string; threats: string[] }
export type Assessment = {
  risk: 'high' | 'medium' | 'low' | 'insufficient'; basis: string; rules_ran: boolean;
  findings: Finding[]; ai_status: string; ai: Record<string, string | string[]> | null;
  links: LinkCheck[]; limitations: string[]; actions: string[];
}

export async function post(path: string, data: object): Promise<Response> {
  const form = data instanceof FormData
  const response = await fetch('/api/' + path, {
    method: 'POST', body: form ? data : JSON.stringify(data),
    headers: form ? undefined : { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(85000),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(typeof error?.detail === 'string' ? error.detail : 'failed')
  }
  return response
}

export function download(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

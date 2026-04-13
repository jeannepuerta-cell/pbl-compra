// In-memory toggle for webhook mode (persists while Next.js process runs)
let currentMode: 'producao' | 'teste' = (process.env.N8N_WEBHOOK_MODE as 'producao' | 'teste') || 'producao'

export function getWebhookUrl(): string {
  if (currentMode === 'teste') {
    return process.env.N8N_SEND_WEBHOOK_TEST_URL || ''
  }
  return process.env.N8N_SEND_WEBHOOK_URL || ''
}

export function getWebhookMode(): 'producao' | 'teste' {
  return currentMode
}

export function setWebhookMode(modo: 'producao' | 'teste') {
  currentMode = modo
}

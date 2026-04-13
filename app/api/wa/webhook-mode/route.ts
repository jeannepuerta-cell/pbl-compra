import { NextRequest, NextResponse } from 'next/server'
import { checkWaAccess } from '@/lib/wa-auth'
import { getWebhookUrl, getWebhookMode, setWebhookMode } from '@/lib/wa-webhook'

export async function GET() {
  const access = await checkWaAccess()
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  return NextResponse.json({
    modo: getWebhookMode(),
    url_ativa: getWebhookUrl(),
  })
}

export async function PUT(request: NextRequest) {
  const access = await checkWaAccess()
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  }

  const { modo } = await request.json()

  if (modo !== 'producao' && modo !== 'teste') {
    return NextResponse.json({ error: 'Modo deve ser "producao" ou "teste".' }, { status: 400 })
  }

  setWebhookMode(modo)

  return NextResponse.json({
    modo: getWebhookMode(),
    url_ativa: getWebhookUrl(),
  })
}

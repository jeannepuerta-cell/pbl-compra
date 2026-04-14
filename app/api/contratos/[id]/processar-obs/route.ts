import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkContratosAccess } from '@/lib/contratos/auth'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkContratosAccess()
  if (!auth) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  // 1. Fetch fechamento
  const { data: fechamento, error: fetchError } = await supabase
    .from('ct_fechamentos')
    .select('observacoes_raw, observacoes_processadas')
    .eq('id', id)
    .single()

  if (fetchError || !fechamento) {
    return NextResponse.json({ error: 'Fechamento nao encontrado' }, { status: 404 })
  }

  // 2. Validate observacoes_raw exists
  if (!fechamento.observacoes_raw) {
    return NextResponse.json(
      { error: 'Nenhuma observacao para processar' },
      { status: 400 }
    )
  }

  // 3. Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    const placeholder =
      'Processamento de observacoes indisponivel: chave de API nao configurada. Utilize o texto original das observacoes.'

    await supabase
      .from('ct_fechamentos')
      .update({
        observacoes_processadas: placeholder,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ textoProcessado: placeholder })
  }

  // 4. Call Anthropic API
  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Voce e um assistente juridico especializado em contratos de cessao de credito judicial. Reescreva as observacoes abaixo em linguagem juridica formal, mantendo o sentido original. Retorne apenas o texto reescrito, sem explicacoes adicionais.\n\nObservacoes:\n${fechamento.observacoes_raw}`,
      },
    ],
  })

  const block = message.content[0]
  const textoProcessado = block.type === 'text' ? block.text : fechamento.observacoes_raw

  // 5. Save to DB
  await supabase
    .from('ct_fechamentos')
    .update({
      observacoes_processadas: textoProcessado,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  // 6. Return result
  return NextResponse.json({ textoProcessado })
}

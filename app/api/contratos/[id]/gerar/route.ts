import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkContratosAccess } from '@/lib/contratos/auth'
import { gerarDocx } from '@/lib/contratos/gerar-docx'
import { Fechamento } from '@/lib/contratos/types'
import Anthropic from '@anthropic-ai/sdk'

async function processarObservacoes(texto: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return texto
  }

  const client = new Anthropic({ apiKey })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Voce e um assistente juridico especializado em contratos de cessao de credito judicial. Reescreva as observacoes abaixo em linguagem juridica formal, mantendo o sentido original. Retorne apenas o texto reescrito, sem explicacoes adicionais.\n\nObservacoes:\n${texto}`,
      },
    ],
  })

  const block = message.content[0]
  if (block.type === 'text') {
    return block.text
  }

  return texto
}

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
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError || !fechamento) {
    return NextResponse.json({ error: 'Fechamento nao encontrado' }, { status: 404 })
  }

  const f = fechamento as Fechamento

  // 2. Process observations with AI if needed
  if (f.observacoes_raw && !f.observacoes_processadas) {
    const textoProcessado = await processarObservacoes(f.observacoes_raw)
    f.observacoes_processadas = textoProcessado

    await supabase
      .from('ct_fechamentos')
      .update({ observacoes_processadas: textoProcessado })
      .eq('id', id)
  }

  // 3. Generate the .docx
  const buffer = await gerarDocx(f)

  // 4. Create ct_contratos record
  const nomeArquivo = `contrato_${f.numero_processo.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`

  await supabase.from('ct_contratos').insert({
    fechamento_id: id,
    nome_arquivo: nomeArquivo,
    gerado_por: auth.userId,
  })

  // 5. Update fechamento status
  await supabase
    .from('ct_fechamentos')
    .update({ status: 'gerado', updated_at: new Date().toISOString() })
    .eq('id', id)

  // 6. Return the buffer as .docx download
  const uint8 = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${nomeArquivo}"`,
      'Content-Length': String(buffer.length),
    },
  })
}

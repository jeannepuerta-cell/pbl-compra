import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkWaAccess } from '@/lib/wa-auth'

export async function POST(request: NextRequest) {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const body = await request.json()
    const { conversa_id, conteudo, autor } = body

    if (!conversa_id || !conteudo) {
      return NextResponse.json(
        { error: 'conversa_id e conteudo sao obrigatorios.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Insert the message
    const { data: mensagem, error: msgError } = await supabase
      .from('wa_mensagens')
      .insert({
        conversa_id,
        direcao: 'out',
        autor: autor || 'humano',
        conteudo,
        aprovada_por: access.userId,
        metadata: {},
      })
      .select()
      .single()

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 })
    }

    // Update ultima_mensagem_at on the conversa
    const { error: updateError } = await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_at: new Date().toISOString() })
      .eq('id', conversa_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Forward to n8n webhook if configured
    const webhookUrl = process.env.N8N_SEND_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversa_id,
            conteudo,
            autor: autor || 'humano',
            mensagem_id: mensagem.id,
          }),
        })
      } catch {
        // Log but don't fail the request if webhook fails
        console.error('Falha ao enviar para webhook n8n')
      }
    }

    return NextResponse.json({ success: true, mensagem })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

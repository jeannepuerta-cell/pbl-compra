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
    const { conversa_id, mensagem_id, instrucao } = body

    if (!conversa_id || !mensagem_id || !instrucao) {
      return NextResponse.json(
        { error: 'conversa_id, mensagem_id e instrucao sao obrigatorios.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Fetch the original message
    const { data: mensagem, error: fetchError } = await supabase
      .from('wa_mensagens')
      .select('*')
      .eq('id', mensagem_id)
      .eq('conversa_id', conversa_id)
      .single()

    if (fetchError || !mensagem) {
      return NextResponse.json({ error: 'Mensagem nao encontrada.' }, { status: 404 })
    }

    const original = mensagem.resposta_sugerida_ia || mensagem.conteudo

    // Generate refined version (placeholder without OpenAI)
    let newSuggestion: string

    if (process.env.OPENAI_API_KEY) {
      // Future: integrate with OpenAI for real refinement
      newSuggestion = `[Refinado] ${original}`
    } else {
      newSuggestion = `[Refinado] ${original}`
    }

    // Update the message with the refinement instruction and new suggestion
    const { error: updateError } = await supabase
      .from('wa_mensagens')
      .update({
        instrucao_refinamento: instrucao,
        resposta_sugerida_ia: newSuggestion,
      })
      .eq('id', mensagem_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ sugestao: newSuggestion })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

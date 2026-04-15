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
        { error: 'conversa_id, mensagem_id e instrucao são obrigatórios.' },
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
      return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 })
    }

    const sugestaoOriginal = mensagem.resposta_sugerida_ia || mensagem.conteudo

    // Buscar a pergunta do cliente (última mensagem 'in' antes da sugestão)
    const { data: perguntaMsg } = await supabase
      .from('wa_mensagens')
      .select('conteudo')
      .eq('conversa_id', conversa_id)
      .eq('direcao', 'in')
      .lt('created_at', mensagem.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const pergunta = perguntaMsg?.conteudo || ''

    // Buscar o prompt de refinamento do bot
    const { data: conversa } = await supabase
      .from('wa_conversas')
      .select('bot_id')
      .eq('id', conversa_id)
      .single()

    let promptRefinamento = null
    if (conversa?.bot_id) {
      const { data: bot } = await supabase
        .from('wa_bots_config')
        .select('prompt_refinamento_id')
        .eq('id', conversa.bot_id)
        .single()

      if (bot?.prompt_refinamento_id) {
        const { data: prompt } = await supabase
          .from('wa_prompts')
          .select('*')
          .eq('id', bot.prompt_refinamento_id)
          .single()
        promptRefinamento = prompt
      }
    }

    let novaSugestao = ''
    const openaiKey = process.env.OPENAI_API_KEY

    if (openaiKey) {
      try {
        const systemPrompt = promptRefinamento?.system_prompt ||
          `Você é um assistente de reescrita de respostas de atendimento ao cliente.
Sua tarefa é reescrever a resposta da IA baseado na orientação do atendente humano.
A nova resposta deve substituir completamente a anterior.
Retorne APENAS o texto da nova resposta, sem explicações, sem prefixos, sem aspas.`

        const openaiRes = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: promptRefinamento?.modelo || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
            input: `A IA respondeu:\n\n${sugestaoOriginal}\n\nReescreva essa resposta baseado na orientação fornecida pelo humano responsável:\n\n${instrucao}\n\nA resposta deve substituir o conteúdo anterior da IA.`,
            instructions: systemPrompt,
            store: true,
          }),
        })

        const openaiData = await openaiRes.json()

        if (openaiData.error) {
          console.error('OpenAI refine error:', JSON.stringify(openaiData.error))
          novaSugestao = `[Erro ao refinar: ${openaiData.error.message}]`
        } else if (openaiData.output) {
          for (const item of openaiData.output) {
            if (item.type === 'message' && item.content) {
              for (const c of item.content) {
                if (c.type === 'output_text') {
                  novaSugestao += c.text
                }
              }
            }
          }
        }

        if (!novaSugestao) {
          novaSugestao = `[IA não gerou refinamento. Instrução: "${instrucao}"]`
        }
      } catch (err) {
        console.error('OpenAI refine fetch error:', err)
        novaSugestao = `[Erro ao refinar. Instrução: "${instrucao}"]`
      }
    } else {
      novaSugestao = `[Configure OPENAI_API_KEY] Instrução: "${instrucao}" | Original: ${sugestaoOriginal}`
    }

    // Update the message with the new suggestion and refinement instruction
    const { error: updateError } = await supabase
      .from('wa_mensagens')
      .update({
        instrucao_refinamento: instrucao,
        resposta_sugerida_ia: novaSugestao,
        conteudo: novaSugestao,
      })
      .eq('id', mensagem_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ sugestao: novaSugestao })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

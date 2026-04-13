import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { telefone, mensagem, bot_id } = body

    if (!telefone || !mensagem) {
      return NextResponse.json(
        { error: 'telefone e mensagem sao obrigatorios.' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Find or create cliente
    let { data: cliente } = await supabase
      .from('wa_clientes')
      .select('*')
      .eq('telefone', telefone)
      .single()

    if (!cliente) {
      const { data: novoCliente, error: clienteError } = await supabase
        .from('wa_clientes')
        .insert({ telefone, metadata: {} })
        .select()
        .single()

      if (clienteError) {
        return NextResponse.json({ error: clienteError.message }, { status: 500 })
      }
      cliente = novoCliente
    }

    // Load bot config if bot_id provided
    let bot = null
    if (bot_id) {
      const { data: botData } = await supabase
        .from('wa_bots_config')
        .select('*')
        .eq('id', bot_id)
        .single()
      bot = botData
    }

    // If bot exists but is not active, return null
    if (bot && !bot.ativo) {
      return NextResponse.json({ texto: null, motivo: 'bot_inativo' })
    }

    // Check palavras_escalacao
    if (bot?.palavras_escalacao?.length) {
      const msgLower = mensagem.toLowerCase()
      const shouldEscalate = bot.palavras_escalacao.some(
        (p: string) => msgLower.includes(p.toLowerCase())
      )
      if (shouldEscalate) {
        return NextResponse.json({ escalar: true })
      }
    }

    // Find or create conversa
    let conversaQuery = supabase
      .from('wa_conversas')
      .select('*')
      .eq('cliente_id', cliente.id)
      .in('status', ['ativa', 'escalada'])

    if (bot_id) {
      conversaQuery = conversaQuery.eq('bot_id', bot_id)
    }

    let { data: conversa } = await conversaQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conversa) {
      const { data: novaConversa, error: conversaError } = await supabase
        .from('wa_conversas')
        .insert({
          cliente_id: cliente.id,
          bot_id: bot_id || null,
          canal: 'whatsapp',
          status: 'ativa',
          boas_vindas_enviada: false,
          ultima_mensagem_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (conversaError) {
        return NextResponse.json({ error: conversaError.message }, { status: 500 })
      }
      conversa = novaConversa
    }

    // Check if boas-vindas should be sent
    if (bot?.mensagem_boas_vindas && !conversa.boas_vindas_enviada) {
      // Mark boas-vindas as sent
      await supabase
        .from('wa_conversas')
        .update({ boas_vindas_enviada: true })
        .eq('id', conversa.id)

      // Save boas-vindas as system message
      await supabase.from('wa_mensagens').insert({
        conversa_id: conversa.id,
        direcao: 'out',
        autor: 'sistema',
        conteudo: bot.mensagem_boas_vindas,
        metadata: {},
      })

      return NextResponse.json({
        texto: bot.mensagem_boas_vindas,
        tipo: 'boas_vindas',
      })
    }

    // Save incoming message
    await supabase.from('wa_mensagens').insert({
      conversa_id: conversa.id,
      direcao: 'in',
      autor: 'cliente',
      conteudo: mensagem,
      metadata: {},
    })

    // Update ultima_mensagem_at
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_at: new Date().toISOString() })
      .eq('id', conversa.id)

    // Generate AI response (placeholder without OpenAI)
    let promptText = 'Voce e um assistente virtual.'
    if (bot?.prompt_atendimento_id) {
      const { data: prompt } = await supabase
        .from('wa_prompts')
        .select('system_prompt')
        .eq('id', bot.prompt_atendimento_id)
        .single()
      if (prompt) {
        promptText = prompt.system_prompt
      }
    }

    let aiResponse: string

    if (process.env.OPENAI_API_KEY) {
      // Future: integrate with OpenAI here
      aiResponse = `[IA] Resposta baseada no prompt: "${promptText.substring(0, 50)}..." para: "${mensagem}"`
    } else {
      aiResponse = `[Placeholder IA] Recebi sua mensagem: "${mensagem}". Prompt configurado: "${promptText.substring(0, 80)}..."`
    }

    const modo = bot?.modo || 'treinamento'

    if (modo === 'treinamento') {
      // Save suggestion, don't send
      await supabase.from('wa_mensagens').insert({
        conversa_id: conversa.id,
        direcao: 'out',
        autor: 'ia',
        conteudo: '',
        resposta_sugerida_ia: aiResponse,
        modo_no_momento: 'treinamento',
        prompt_id_usado: bot?.prompt_atendimento_id || null,
        metadata: {},
      })

      return NextResponse.json({
        texto: null,
        sugestao: aiResponse,
        aguardando_humano: true,
      })
    }

    // modo === 'producao'
    await supabase.from('wa_mensagens').insert({
      conversa_id: conversa.id,
      direcao: 'out',
      autor: 'ia',
      conteudo: aiResponse,
      modo_no_momento: 'producao',
      prompt_id_usado: bot?.prompt_atendimento_id || null,
      metadata: {},
    })

    return NextResponse.json({
      texto: aiResponse,
      tipo: 'resposta_ia',
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

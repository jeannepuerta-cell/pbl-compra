import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { telefone, mensagem, bot_id } = await req.json()

    if (!telefone || !mensagem || !bot_id) {
      return new Response(
        JSON.stringify({ error: "Campos telefone, mensagem e bot_id são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    const openaiModel = Deno.env.get("OPENAI_DEFAULT_MODEL") || "gpt-4o-mini"
    const n8nSendWebhook = Deno.env.get("N8N_SEND_WEBHOOK_URL")

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Fetch bot config
    const { data: bot, error: botErr } = await supabase
      .from("wa_bots_config")
      .select("*, prompt_atendimento:wa_prompts!prompt_atendimento_id(*)")
      .eq("id", bot_id)
      .single()

    if (botErr || !bot) {
      return new Response(
        JSON.stringify({ error: "Bot não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Bot desligado
    if (!bot.ativo) {
      return new Response(
        JSON.stringify({ ativo: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Find or create cliente
    let { data: cliente } = await supabase
      .from("wa_clientes")
      .select("*")
      .eq("telefone", telefone)
      .maybeSingle()

    if (!cliente) {
      const { data: novoCliente } = await supabase
        .from("wa_clientes")
        .insert({ telefone })
        .select()
        .single()
      cliente = novoCliente
    }

    if (!cliente) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar cliente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 3. Agregar mensagem no cliente
    const mensagemAgregada = cliente.mensagem_agregada
      ? cliente.mensagem_agregada + "\n" + mensagem
      : mensagem

    await supabase
      .from("wa_clientes")
      .update({ mensagem_agregada: mensagemAgregada, conversa_iniciada: false })
      .eq("id", cliente.id)

    // 4. Find or create conversa
    let { data: conversa } = await supabase
      .from("wa_conversas")
      .select("*")
      .eq("cliente_id", cliente.id)
      .eq("bot_id", bot_id)
      .in("status", ["ativa", "escalada"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conversa) {
      const { data: novaConversa } = await supabase
        .from("wa_conversas")
        .insert({ cliente_id: cliente.id, bot_id, canal: "whatsapp" })
        .select()
        .single()
      conversa = novaConversa
    }

    if (!conversa) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar conversa." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Verificar se IA está desabilitada nesta conversa
    if (conversa.ia_desabilitada) {
      // Salvar mensagem do cliente mas não gerar resposta
      await supabase.from("wa_mensagens").insert({
        conversa_id: conversa.id,
        direcao: "in",
        autor: "cliente",
        conteudo: mensagem,
        modo_no_momento: bot.modo,
      })

      await supabase
        .from("wa_conversas")
        .update({ ultima_mensagem_at: new Date().toISOString() })
        .eq("id", conversa.id)

      return new Response(
        JSON.stringify({
          texto: null,
          ia_desabilitada: true,
          conversa_id: conversa.id,
          cliente_id: cliente.id,
          telefone,
          bot_nome: bot.nome,
          modo: bot.modo,
          modo_treinamento: bot.modo === "treinamento",
          status: conversa.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 6. Verificar palavras de escalação
    const palavrasEscalacao: string[] = bot.palavras_escalacao || []
    const msgLower = mensagem.toLowerCase()
    const deveEscalar = palavrasEscalacao.some((p: string) => msgLower.includes(p.toLowerCase()))

    if (deveEscalar) {
      // Marcar conversa como escalada
      await supabase
        .from("wa_conversas")
        .update({ status: "escalada", ultima_mensagem_at: new Date().toISOString() })
        .eq("id", conversa.id)

      // Salvar mensagem in
      await supabase.from("wa_mensagens").insert({
        conversa_id: conversa.id,
        direcao: "in",
        autor: "cliente",
        conteudo: mensagem,
        modo_no_momento: bot.modo,
      })

      return new Response(
        JSON.stringify({
          escalar: true,
          telefone,
          mensagem_original: mensagem,
          conversa_id: conversa.id,
          cliente_id: cliente.id,
          bot_nome: bot.nome,
          modo: bot.modo,
          modo_treinamento: bot.modo === "treinamento",
          status: "escalada",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 6. Boas-vindas (primeira mensagem)
    if (!conversa.boas_vindas_enviada) {
      await supabase
        .from("wa_conversas")
        .update({ boas_vindas_enviada: true, ultima_mensagem_at: new Date().toISOString() })
        .eq("id", conversa.id)

      // Salvar mensagem in
      await supabase.from("wa_mensagens").insert({
        conversa_id: conversa.id,
        direcao: "in",
        autor: "cliente",
        conteudo: mensagem,
        modo_no_momento: bot.modo,
      })

      // Salvar boas-vindas como out
      await supabase.from("wa_mensagens").insert({
        conversa_id: conversa.id,
        direcao: "out",
        autor: "sistema",
        conteudo: bot.mensagem_boas_vindas,
        modo_no_momento: bot.modo,
      })

      // Enviar boas-vindas via webhook n8n
      if (n8nSendWebhook) {
        try {
          await fetch(n8nSendWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ telefone, mensagem: bot.mensagem_boas_vindas }),
          })
        } catch { /* ignora erro de webhook */ }
      }

      return new Response(
        JSON.stringify({
          texto: bot.mensagem_boas_vindas,
          tipo: "boas_vindas",
          conversa_id: conversa.id,
          cliente_id: cliente.id,
          telefone,
          bot_nome: bot.nome,
          modo: bot.modo,
          modo_treinamento: bot.modo === "treinamento",
          status: "ativa",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 7. Salvar mensagem do cliente
    await supabase.from("wa_mensagens").insert({
      conversa_id: conversa.id,
      direcao: "in",
      autor: "cliente",
      conteudo: mensagem,
      modo_no_momento: bot.modo,
    })

    // 8. Gerar resposta da IA
    let respostaIA = ""
    const prompt = bot.prompt_atendimento

    if (openaiKey && prompt) {
      // Montar guard rails no system prompt
      let systemPrompt = prompt.system_prompt
      if (prompt.guard_rails && Object.keys(prompt.guard_rails).length > 0) {
        const gr = prompt.guard_rails as Record<string, unknown>
        systemPrompt += "\n\n--- REGRAS DE SEGURANÇA ---"
        if (gr.nunca_prometer) systemPrompt += `\nNunca prometer: ${JSON.stringify(gr.nunca_prometer)}`
        if (gr.sempre_escalar_se) systemPrompt += `\nSempre escalar se: ${JSON.stringify(gr.sempre_escalar_se)}`
        if (gr.tom) systemPrompt += `\nTom: ${gr.tom}`
        if (gr.proibido_mencionar) systemPrompt += `\nProibido mencionar: ${JSON.stringify(gr.proibido_mencionar)}`
      }

      // Buscar histórico da conversa para contexto
      const { data: historico } = await supabase
        .from("wa_mensagens")
        .select("direcao, autor, conteudo")
        .eq("conversa_id", conversa.id)
        .order("created_at", { ascending: true })
        .limit(20)

      const messages: Array<{ role: string; content: string }> = [
        { role: "system", content: systemPrompt },
      ]

      if (historico) {
        for (const msg of historico) {
          messages.push({
            role: msg.direcao === "in" ? "user" : "assistant",
            content: msg.conteudo,
          })
        }
      }

      // Adicionar a mensagem atual
      messages.push({ role: "user", content: mensagem })

      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: prompt.modelo || openaiModel,
            messages,
            temperature: prompt.temperatura || 0.3,
          }),
        })

        const openaiData = await openaiRes.json()
        respostaIA = openaiData.choices?.[0]?.message?.content || ""
      } catch {
        respostaIA = "[Erro ao gerar resposta da IA. Um atendente entrará em contato.]"
      }
    } else {
      respostaIA = `Obrigado pela sua mensagem. Um atendente da PBL Compra entrará em contato em breve.`
    }

    // 9. Atualizar conversa
    await supabase
      .from("wa_conversas")
      .update({ ultima_mensagem_at: new Date().toISOString() })
      .eq("id", conversa.id)

    // Limpar mensagem agregada e marcar conversa como iniciada
    await supabase
      .from("wa_clientes")
      .update({ mensagem_agregada: "", conversa_iniciada: true })
      .eq("id", cliente.id)

    // 10. Modo treinamento vs produção
    if (bot.modo === "treinamento") {
      // Salvar sugestão sem enviar
      await supabase.from("wa_mensagens").insert({
        conversa_id: conversa.id,
        direcao: "out",
        autor: "ia",
        conteudo: respostaIA,
        resposta_sugerida_ia: respostaIA,
        modo_no_momento: "treinamento",
        prompt_id_usado: prompt?.id || null,
      })

      return new Response(
        JSON.stringify({
          texto: null,
          sugestao: respostaIA,
          aguardando_humano: true,
          conversa_id: conversa.id,
          cliente_id: cliente.id,
          telefone,
          bot_nome: bot.nome,
          modo: bot.modo,
          modo_treinamento: true,
          status: conversa.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Modo produção — enviar direto
    await supabase.from("wa_mensagens").insert({
      conversa_id: conversa.id,
      direcao: "out",
      autor: "ia",
      conteudo: respostaIA,
      resposta_sugerida_ia: respostaIA,
      modo_no_momento: "producao",
      prompt_id_usado: prompt?.id || null,
    })

    // Enviar via webhook n8n
    if (n8nSendWebhook) {
      try {
        await fetch(n8nSendWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefone, mensagem: respostaIA }),
        })
      } catch { /* ignora erro de webhook */ }
    }

    return new Response(
      JSON.stringify({
        texto: respostaIA,
        tipo: "resposta_ia",
        conversa_id: conversa.id,
        cliente_id: cliente.id,
        telefone,
        bot_nome: bot.nome,
        modo: bot.modo,
        modo_treinamento: false,
        status: conversa.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

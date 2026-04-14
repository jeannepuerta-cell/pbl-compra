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
    const nomeAtendente = Deno.env.get("NOME_DO_ATENDENTE") || "Assistente PBL"
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

      const nomeCliente = cliente.nome || telefone

      return new Response(
        JSON.stringify({
          texto: `⚠️ *ATENÇÃO — IA SUSPENSA* ⚠️\n\n👤 *Cliente:* ${nomeCliente}\n📱 *Telefone:* ${telefone}\n\n💬 *Mensagem recebida:*\n_${mensagem}_\n\n🚫 Este cliente está com o serviço de IA suspenso.\n👉 *Um atendente precisa responder manualmente.*\n\n🔗 wa.me/${telefone.replace(/\D/g, '')}`,
          ia_desabilitada: true,
          conversa_id: conversa.id,
          cliente_id: cliente.id,
          telefone,
          nome_cliente: nomeCliente,
          mensagem_original: mensagem,
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

      // Salvar boas-vindas como out (substituir {{NOME_DO_ATENDENTE}})
      const boasVindas = (bot.mensagem_boas_vindas || '').replace(/\{\{NOME_DO_ATENDENTE\}\}/g, nomeAtendente)

      await supabase.from("wa_mensagens").insert({
        conversa_id: conversa.id,
        direcao: "out",
        autor: "sistema",
        conteudo: boasVindas,
        modo_no_momento: bot.modo,
      })

      // Enviar boas-vindas via webhook n8n
      if (n8nSendWebhook) {
        try {
          await fetch(n8nSendWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ telefone, mensagem: boasVindas }),
          })
        } catch { /* ignora erro de webhook */ }
      }

      return new Response(
        JSON.stringify({
          texto: boasVindas,
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
      // Substituir variável de nome e montar guard rails
      let systemPrompt = (prompt.system_prompt || '').replace(/\{\{NOME_DO_ATENDENTE\}\}/g, nomeAtendente)
      if (prompt.guard_rails && Object.keys(prompt.guard_rails).length > 0) {
        const gr = prompt.guard_rails as Record<string, unknown>
        systemPrompt += "\n\n--- REGRAS DE SEGURANÇA ---"
        if (gr.nunca_prometer) systemPrompt += `\nNunca prometer: ${JSON.stringify(gr.nunca_prometer)}`
        if (gr.sempre_escalar_se) systemPrompt += `\nSempre escalar se: ${JSON.stringify(gr.sempre_escalar_se)}`
        if (gr.tom) systemPrompt += `\nTom: ${gr.tom}`
        if (gr.proibido_mencionar) systemPrompt += `\nProibido mencionar: ${JSON.stringify(gr.proibido_mencionar)}`
      }

      try {
        // Usar Responses API com previous_response_id para manter conversa com cache
        const previousResponseId = conversa.openai_conversation_id || undefined

        const modelo = prompt.modelo || openaiModel
        const isReasoningModel = modelo.includes("o1") || modelo.includes("o3") || modelo.includes("o4") || modelo.includes("gpt-5")

        const requestBody: Record<string, unknown> = {
          model: modelo,
          input: mensagem,
          instructions: systemPrompt,
          top_p: 0.98,
          store: true,
        }

        // temperature só para modelos não-reasoning
        if (!isReasoningModel) {
          requestBody.temperature = prompt.temperatura || 0.3
        }

        // reasoning params só para modelos que suportam
        if (isReasoningModel) {
          requestBody.reasoning = {
            effort: "medium",
            summary: "concise",
          }
        }

        // Se já tem conversa anterior, encadeia (usa cache)
        if (previousResponseId) {
          requestBody.previous_response_id = previousResponseId
        }

        console.log("=== OPENAI REQUEST ===")
        console.log("Model:", requestBody.model)
        console.log("isReasoningModel:", isReasoningModel)
        console.log("Full requestBody:", JSON.stringify(requestBody, null, 2))

        const openaiRes = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        const openaiRawText = await openaiRes.text()
        console.log("=== OPENAI RESPONSE STATUS ===", openaiRes.status)
        console.log("=== OPENAI RESPONSE BODY ===", openaiRawText.substring(0, 1000))

        const openaiData = JSON.parse(openaiRawText)

        // Verificar se houve erro na API
        if (openaiData.error) {
          console.error("OpenAI error:", JSON.stringify(openaiData.error))
          respostaIA = `[Erro da IA: ${openaiData.error.message || "erro desconhecido"}]`
        } else {
          // Extrair texto da resposta
          respostaIA = ""
          if (openaiData.output) {
            for (const item of openaiData.output) {
              if (item.type === "message" && item.content) {
                for (const c of item.content) {
                  if (c.type === "output_text") {
                    respostaIA += c.text
                  }
                }
              }
            }
          }

          // Fallback: tentar output_text direto (formatos alternativos)
          if (!respostaIA && openaiData.output_text) {
            respostaIA = openaiData.output_text
          }

          // Se ainda vazio, logar a resposta completa
          if (!respostaIA) {
            console.error("OpenAI resposta sem texto:", JSON.stringify(openaiData).substring(0, 500))
            respostaIA = "[IA não gerou resposta. Um atendente entrará em contato.]"
          }

          // Salvar o response_id para encadear próximas mensagens (cache)
          if (openaiData.id) {
            await supabase
              .from("wa_conversas")
              .update({ openai_conversation_id: openaiData.id })
              .eq("id", conversa.id)
          }
        }
      } catch (err) {
        console.error("OpenAI fetch error:", err)
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

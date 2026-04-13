import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { conversa_id, mensagem_id, instrucao } = await req.json()

    if (!conversa_id || !mensagem_id || !instrucao) {
      return new Response(
        JSON.stringify({ error: "Campos conversa_id, mensagem_id e instrucao são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    const openaiModel = Deno.env.get("OPENAI_DEFAULT_MODEL") || "gpt-4o-mini"

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar a mensagem original
    const { data: mensagem, error: msgErr } = await supabase
      .from("wa_mensagens")
      .select("*")
      .eq("id", mensagem_id)
      .single()

    if (msgErr || !mensagem) {
      return new Response(
        JSON.stringify({ error: "Mensagem não encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Buscar a pergunta do cliente (última mensagem 'in' antes desta)
    const { data: perguntaMsg } = await supabase
      .from("wa_mensagens")
      .select("conteudo")
      .eq("conversa_id", conversa_id)
      .eq("direcao", "in")
      .lt("created_at", mensagem.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    const pergunta = perguntaMsg?.conteudo || ""
    const sugestaoOriginal = mensagem.resposta_sugerida_ia || mensagem.conteudo

    // Buscar prompt de refinamento do bot
    const { data: conversa } = await supabase
      .from("wa_conversas")
      .select("bot_id")
      .eq("id", conversa_id)
      .single()

    let promptRefinamento = null
    if (conversa?.bot_id) {
      const { data: bot } = await supabase
        .from("wa_bots_config")
        .select("prompt_refinamento_id")
        .eq("id", conversa.bot_id)
        .single()

      if (bot?.prompt_refinamento_id) {
        const { data: prompt } = await supabase
          .from("wa_prompts")
          .select("*")
          .eq("id", bot.prompt_refinamento_id)
          .single()
        promptRefinamento = prompt
      }
    }

    let novaSugestao = ""

    if (openaiKey && promptRefinamento) {
      try {
        const messages = [
          { role: "system", content: promptRefinamento.system_prompt },
          {
            role: "user",
            content: `Pergunta do cliente: ${pergunta}\n\nSugestão original da IA: ${sugestaoOriginal}\n\nInstrução do atendente: ${instrucao}\n\nGere uma nova versão da resposta seguindo a instrução.`,
          },
        ]

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: promptRefinamento.modelo || openaiModel,
            messages,
            temperature: promptRefinamento.temperatura || 0.3,
          }),
        })

        const openaiData = await openaiRes.json()
        novaSugestao = openaiData.choices?.[0]?.message?.content || ""
      } catch {
        novaSugestao = `[Refinado conforme instrução: "${instrucao}"] ${sugestaoOriginal}`
      }
    } else {
      novaSugestao = `[Refinado conforme instrução: "${instrucao}"] ${sugestaoOriginal}`
    }

    // Atualizar mensagem com a instrução e nova sugestão
    await supabase
      .from("wa_mensagens")
      .update({
        instrucao_refinamento: instrucao,
        resposta_sugerida_ia: novaSugestao,
        conteudo: novaSugestao,
      })
      .eq("id", mensagem_id)

    return new Response(
      JSON.stringify({ sugestao: novaSugestao }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Erro interno." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { bot_id, periodo_inicio, periodo_fim } = await req.json()

    if (!bot_id || !periodo_inicio || !periodo_fim) {
      return new Response(
        JSON.stringify({ error: "Campos bot_id, periodo_inicio e periodo_fim são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    const openaiModel = Deno.env.get("OPENAI_DEFAULT_MODEL") || "gpt-4o-mini"

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar bot e seu prompt de atendimento
    const { data: bot } = await supabase
      .from("wa_bots_config")
      .select("*, prompt_atendimento:wa_prompts!prompt_atendimento_id(*)")
      .eq("id", bot_id)
      .single()

    if (!bot) {
      return new Response(
        JSON.stringify({ error: "Bot não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Buscar conversas do bot no período
    const { data: conversas } = await supabase
      .from("wa_conversas")
      .select("id")
      .eq("bot_id", bot_id)

    if (!conversas || conversas.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma conversa encontrada para este bot." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const conversaIds = conversas.map((c: { id: string }) => c.id)

    // Buscar mensagens 'out' no período onde houve divergência ou refinamento
    const { data: mensagens } = await supabase
      .from("wa_mensagens")
      .select("*")
      .in("conversa_id", conversaIds)
      .eq("direcao", "out")
      .gte("created_at", periodo_inicio)
      .lte("created_at", periodo_fim)
      .order("created_at", { ascending: true })

    // Filtrar divergências (sugestão != conteúdo final, ou tem instrução de refinamento)
    const divergencias = (mensagens || []).filter((m: Record<string, unknown>) =>
      (m.resposta_sugerida_ia && m.resposta_sugerida_ia !== m.conteudo) ||
      m.instrucao_refinamento
    )

    if (divergencias.length === 0) {
      return new Response(
        JSON.stringify({
          analise: "Nenhuma divergência encontrada no período. O bot está alinhado com as respostas dos atendentes.",
          divergencias_analisadas: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Montar payload para análise
    const trios = divergencias.map((m: Record<string, unknown>) => ({
      sugestao_ia: m.resposta_sugerida_ia,
      resposta_final: m.conteudo,
      instrucao_refinamento: m.instrucao_refinamento || null,
    }))

    // Buscar prompt de análise
    const { data: promptAnalise } = await supabase
      .from("wa_prompts")
      .select("*")
      .eq("tipo", "analise_divergencia")
      .eq("ativo", true)
      .limit(1)
      .single()

    let analiseTexto = ""

    if (openaiKey && promptAnalise) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: promptAnalise.modelo || openaiModel,
            messages: [
              { role: "system", content: promptAnalise.system_prompt },
              {
                role: "user",
                content: `Analise as seguintes ${trios.length} divergências:\n\n${JSON.stringify(trios, null, 2)}`,
              },
            ],
            temperature: promptAnalise.temperatura || 0.2,
          }),
        })

        const openaiData = await openaiRes.json()
        analiseTexto = openaiData.choices?.[0]?.message?.content || ""
      } catch {
        analiseTexto = `Foram encontradas ${trios.length} divergências no período. Análise automática indisponível (erro na API OpenAI).`
      }
    } else {
      analiseTexto = `Foram encontradas ${trios.length} divergências no período entre ${periodo_inicio} e ${periodo_fim}. Configure a OPENAI_API_KEY para análise automática.`
    }

    // Salvar relatório
    const { data: relatorio } = await supabase
      .from("wa_prompt_relatorios")
      .insert({
        prompt_analisado_id: bot.prompt_atendimento?.id || null,
        periodo_inicio,
        periodo_fim,
        divergencias_analisadas: divergencias.length,
        analise_texto: analiseTexto,
      })
      .select()
      .single()

    return new Response(
      JSON.stringify({
        relatorio_id: relatorio?.id,
        analise: analiseTexto,
        divergencias_analisadas: divergencias.length,
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

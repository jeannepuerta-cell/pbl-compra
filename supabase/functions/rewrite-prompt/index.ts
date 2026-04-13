import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { relatorio_id } = await req.json()

    if (!relatorio_id) {
      return new Response(
        JSON.stringify({ error: "Campo relatorio_id é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const openaiKey = Deno.env.get("OPENAI_API_KEY")
    const openaiModel = Deno.env.get("OPENAI_DEFAULT_MODEL") || "gpt-4o-mini"

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Buscar relatório
    const { data: relatorio } = await supabase
      .from("wa_prompt_relatorios")
      .select("*")
      .eq("id", relatorio_id)
      .single()

    if (!relatorio) {
      return new Response(
        JSON.stringify({ error: "Relatório não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Buscar prompt atual
    const { data: promptAtual } = await supabase
      .from("wa_prompts")
      .select("*")
      .eq("id", relatorio.prompt_analisado_id)
      .single()

    if (!promptAtual) {
      return new Response(
        JSON.stringify({ error: "Prompt original não encontrado." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Buscar prompt de reescrita
    const { data: promptReescrita } = await supabase
      .from("wa_prompts")
      .select("*")
      .eq("tipo", "reescrita_prompt")
      .eq("ativo", true)
      .limit(1)
      .single()

    let promptSugerido = ""

    if (openaiKey && promptReescrita) {
      try {
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: promptReescrita.modelo || openaiModel,
            messages: [
              { role: "system", content: promptReescrita.system_prompt },
              {
                role: "user",
                content: `## Prompt atual:\n${promptAtual.system_prompt}\n\n## Relatório de análise:\n${relatorio.analise_texto}\n\nGere uma versão melhorada do prompt de atendimento.`,
              },
            ],
            temperature: promptReescrita.temperatura || 0.3,
          }),
        })

        const openaiData = await openaiRes.json()
        promptSugerido = openaiData.choices?.[0]?.message?.content || ""
      } catch {
        promptSugerido = `[Reescrita automática indisponível] Prompt original mantido:\n\n${promptAtual.system_prompt}`
      }
    } else {
      promptSugerido = `[Configure OPENAI_API_KEY para reescrita automática]\n\nPrompt original:\n${promptAtual.system_prompt}\n\nSugestão baseada na análise:\n${relatorio.analise_texto}`
    }

    // Salvar prompt sugerido no relatório
    await supabase
      .from("wa_prompt_relatorios")
      .update({ prompt_sugerido: promptSugerido })
      .eq("id", relatorio_id)

    return new Response(
      JSON.stringify({
        relatorio_id,
        prompt_sugerido: promptSugerido,
        prompt_original: promptAtual.system_prompt,
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

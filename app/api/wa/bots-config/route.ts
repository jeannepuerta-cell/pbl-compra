import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkWaAccess } from '@/lib/wa-auth'

export async function GET() {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('wa_bots_config')
      .select(`
        *,
        prompt_atendimento:wa_prompts!prompt_atendimento_id(id, nome),
        prompt_refinamento:wa_prompts!prompt_refinamento_id(id, nome)
      `)
      .order('nome', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const body = await request.json()
    const {
      nome,
      prompt_atendimento_id,
      prompt_refinamento_id,
      modo,
      grupo_whatsapp_id,
      mensagem_boas_vindas,
      palavras_escalacao,
    } = body

    if (!nome) {
      return NextResponse.json({ error: 'nome e obrigatorio.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('wa_bots_config')
      .insert({
        nome,
        prompt_atendimento_id: prompt_atendimento_id || null,
        prompt_refinamento_id: prompt_refinamento_id || null,
        ativo: true,
        modo: modo || 'treinamento',
        grupo_whatsapp_id: grupo_whatsapp_id || null,
        mensagem_boas_vindas: mensagem_boas_vindas || '',
        palavras_escalacao: palavras_escalacao || [],
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const body = await request.json()
    const { id, ...fields } = body

    if (!id) {
      return NextResponse.json({ error: 'ID obrigatorio.' }, { status: 400 })
    }

    const supabase = await createClient()

    const allowedFields: Record<string, unknown> = {}
    const allowed = [
      'nome', 'prompt_atendimento_id', 'prompt_refinamento_id',
      'ativo', 'modo', 'grupo_whatsapp_id',
      'mensagem_boas_vindas', 'palavras_escalacao',
    ]
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        allowedFields[key] = fields[key]
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('wa_bots_config')
      .update(allowedFields)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

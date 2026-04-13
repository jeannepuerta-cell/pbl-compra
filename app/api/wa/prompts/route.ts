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
      .from('wa_prompts')
      .select('*')
      .order('nome', { ascending: true })
      .order('versao', { ascending: false })

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
    const { nome, tipo, system_prompt, modelo, temperatura, guard_rails } = body

    if (!nome || !tipo || !system_prompt) {
      return NextResponse.json(
        { error: 'nome, tipo e system_prompt sao obrigatorios.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('wa_prompts')
      .insert({
        nome,
        tipo,
        system_prompt,
        modelo: modelo || 'gpt-4o-mini',
        temperatura: temperatura ?? 0.7,
        versao: 1,
        ativo: true,
        guard_rails: guard_rails || {},
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

    // Only allow updating specific fields
    const allowedFields: Record<string, unknown> = {}
    const allowed = [
      'nome', 'tipo', 'system_prompt', 'modelo',
      'temperatura', 'ativo', 'guard_rails',
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
      .from('wa_prompts')
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

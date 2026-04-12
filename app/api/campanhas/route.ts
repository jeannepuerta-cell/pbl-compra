import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('campanhas')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const { nome, objetivo, premio, equipe } = await request.json()

    if (!nome) {
      return NextResponse.json({ error: 'Nome e obrigatorio.' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('campanhas')
      .insert({ nome, objetivo: objetivo || null, premio: premio ?? 500, equipe: equipe ?? 'todos' })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()

    const { id, atingido } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'ID e obrigatorio.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('campanhas')
      .update({ atingido })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Campanha atualizada.' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID e obrigatorio.' }, { status: 400 })
    }

    const { error } = await supabase
      .from('campanhas')
      .delete()
      .eq('id', Number(id))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Campanha excluida.' })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}

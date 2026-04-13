import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkWaAccess } from '@/lib/wa-auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('wa_mensagens')
      .select('*')
      .eq('conversa_id', id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { conteudo, autor } = body

    if (!conteudo) {
      return NextResponse.json({ error: 'Conteudo obrigatorio.' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: mensagem, error } = await supabase
      .from('wa_mensagens')
      .insert({
        conversa_id: id,
        direcao: 'out',
        autor: autor || 'humano',
        conteudo,
        aprovada_por: access.userId,
        metadata: {},
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update ultima_mensagem_at on the conversa
    await supabase
      .from('wa_conversas')
      .update({ ultima_mensagem_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json(mensagem, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

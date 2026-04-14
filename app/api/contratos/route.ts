import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkContratosAccess } from '@/lib/contratos/auth'

export async function GET(request: NextRequest) {
  const auth = await checkContratosAccess()
  if (!auth) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const status = searchParams.get('status')
  const comercial = searchParams.get('comercial')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')

  const supabase = await createClient()

  let query = supabase
    .from('ct_fechamentos')
    .select('*, ct_contratos(count)')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }
  if (comercial) {
    query = query.eq('comercial_responsavel', comercial)
  }
  if (dataInicio) {
    query = query.gte('data_fechamento', dataInicio)
  }
  if (dataFim) {
    query = query.lte('data_fechamento', dataFim)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const auth = await checkContratosAccess()
  if (!auth) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 })
  }

  const body = await request.json()

  // Calculate desagio if both values are present
  let desagio: number | null = null
  if (body.valor_condenacao != null && body.valor_fechado != null && body.valor_condenacao > 0) {
    desagio = Math.round(
      ((body.valor_condenacao - body.valor_fechado) / body.valor_condenacao) * 10000
    ) / 100
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ct_fechamentos')
    .insert({
      ...body,
      user_id: auth.userId,
      desagio,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

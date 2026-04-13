import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkWaAccess } from '@/lib/wa-auth'

export async function GET(request: NextRequest) {
  try {
    const access = await checkWaAccess()
    if (!access) {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    let query = supabase
      .from('wa_conversas')
      .select('*, cliente:wa_clientes(*)')
      .order('ultima_mensagem_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

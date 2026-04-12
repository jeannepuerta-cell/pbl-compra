import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'ID do usuário e nova senha são obrigatórios.' },
        { status: 400 }
      )
    }

    if (newPassword.length < 4) {
      return NextResponse.json(
        { error: 'A nova senha deve ter pelo menos 4 caracteres.' },
        { status: 400 }
      )
    }

    // Verify the caller is authenticated
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não autenticado.' },
        { status: 401 }
      )
    }

    // Check if caller is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Perfil não encontrado.' },
        { status: 403 }
      )
    }

    if (profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Apenas administradores podem redefinir senhas de outros usuários.' },
        { status: 403 }
      )
    }

    // Use admin client to reset the target user's password
    const adminClient = createAdminClient()
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    )

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao redefinir senha. Verifique o ID do usuário.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Senha redefinida com sucesso.' })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}

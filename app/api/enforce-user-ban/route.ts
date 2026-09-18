import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      )
    }

    const authHeader = req.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Nicht authentifiziert' },
        { status: 401 }
      )
    }

    const accessToken = authHeader.slice(7)

    // Benutzer ausschließlich anhand des echten Supabase-Tokens bestimmen.
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser(accessToken)

    if (userError || !user?.email) {
      return NextResponse.json(
        { error: 'Ungültige Sitzung' },
        { status: 401 }
      )
    }

    const normalizedEmail = user.email.trim().toLowerCase()

    const emailHash = createHash('sha256')
      .update(normalizedEmail)
      .digest('hex')

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    )

    const { data: ban, error: banError } = await supabaseAdmin
      .from('user_bans')
      .select('id')
      .eq('email_hash', emailHash)
      .maybeSingle()

    if (banError) {
      console.error('Ban enforcement check failed:', banError)

      return NextResponse.json(
        { error: 'Ban-Prüfung fehlgeschlagen' },
        { status: 500 }
      )
    }

    if (!ban) {
      return NextResponse.json({
        banned: false,
      })
    }

    const { error: deleteError } =
      await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (deleteError) {
      console.error('Banned auth user deletion failed:', deleteError)

      return NextResponse.json(
        { error: 'Gesperrter Zugang konnte nicht entfernt werden' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      banned: true,
    })
  } catch (error) {
    console.error('enforce-user-ban error:', error)

    return NextResponse.json(
      { error: 'Ban-Prüfung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
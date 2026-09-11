import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      )
    }

    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email fehlt' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()

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

    const { data, error } = await supabaseAdmin
      .from('user_bans')
      .select('id')
      .eq('email_hash', emailHash)
      .maybeSingle()

    if (error) {
      console.error('Ban check failed:', error)

      return NextResponse.json(
        { error: 'Ban-Prüfung fehlgeschlagen' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      banned: Boolean(data),
    })
  } catch (error) {
    console.error('check-user-ban error:', error)

    return NextResponse.json(
      { error: 'Ban-Prüfung fehlgeschlagen' },
      { status: 500 }
    )
  }
}
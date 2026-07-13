import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { withTimeout } from '@/lib/utils/with-timeout'

// Teto para a revalidação de sessão no middleware. Ver comentario no bloco abaixo.
const AUTH_TIMEOUT_MS = 8_000

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: usar getUser(), não getSession() — getUser() revalida contra o servidor Supabase
  let user
  try {
    // Fail-fast: se o Supabase Auth pendurar (soluço/incidente), abortamos em 8s.
    const {
      data: { user: u },
    } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS, 'auth.getUser (proxy)')
    user = u
  } catch {
    // FAIL-OPEN: em timeout/erro do Auth, deixamos a requisição seguir em vez de
    // redirecionar para /login. Redirecionar aqui com um usuário logado (mas cuja
    // revalidação apenas demorou) criaria um loop e degradaria o app inteiro por
    // um soluço momentâneo. A proteção real da rota continua no layout
    // (getCurrentUser + error.tsx), que trata a instabilidade sem loop.
    return response
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login')
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

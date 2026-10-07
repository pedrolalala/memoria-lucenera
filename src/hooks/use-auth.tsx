/* SPEC-164 — Sessão, SSO do Hub e perfil de acesso (interno / curador). */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { sb } from '@/lib/kb'

type Acesso = 'verificando' | 'liberado' | 'sem_acesso' | 'indisponivel'

interface AuthState {
  carregando: boolean
  session: Session | null
  userId: string | null
  email: string | null
  acesso: Acesso
  curador: boolean
  recuperandoSenha: boolean
  concluirRecuperacao: () => void
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/* A Central manda o usuário com ?sso_code=<uuid>; trocamos por uma sessão
   na Edge Function exchange-cross-system-code (mesmo projeto Supabase). */
async function consumirSso() {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('sso_code')
  if (!code) return
  try {
    const { data } = await sb.functions.invoke('exchange-cross-system-code', {
      body: { code, sistema_destino: 'memoria' },
    })
    if (data?.access_token && data?.refresh_token) {
      await sb.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
    } else if (data?.token_hash) {
      await sb.auth.verifyOtp({ token_hash: data.token_hash, type: 'magiclink' })
    }
  } catch (err) {
    console.error('[memoria] SSO falhou', err)
  }
  params.delete('sso_code')
  const qs = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [acesso, setAcesso] = useState<Acesso>('verificando')
  const [curador, setCurador] = useState(false)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)

  useEffect(() => {
    let ativo = true
    const { data: sub } = sb.auth.onAuthStateChange((evento, s) => {
      if (!ativo) return
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      setSession(s)
    })
    ;(async () => {
      await consumirSso()
      const { data } = await sb.auth.getSession()
      if (!ativo) return
      setSession(data.session)
      setCarregando(false)
    })()
    return () => {
      ativo = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user?.id ?? null

  useEffect(() => {
    if (!userId) {
      setAcesso('verificando')
      setCurador(false)
      return
    }
    let ativo = true
    ;(async () => {
      const [interno, cur] = await Promise.all([sb.rpc('kb_eh_interno'), sb.rpc('kb_eh_curador')])
      if (!ativo) return
      if (interno.error) {
        console.error('[memoria] kb_eh_interno', interno.error)
        setAcesso('indisponivel')
        return
      }
      setAcesso(interno.data ? 'liberado' : 'sem_acesso')
      setCurador(Boolean(cur.data))
    })()
    return () => {
      ativo = false
    }
  }, [userId])

  const valor: AuthState = {
    carregando,
    session,
    userId,
    email: session?.user?.email ?? null,
    acesso,
    curador,
    recuperandoSenha,
    concluirRecuperacao: () => setRecuperandoSenha(false),
    sair: async () => {
      await sb.auth.signOut()
    },
  }

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fora do AuthProvider')
  return ctx
}

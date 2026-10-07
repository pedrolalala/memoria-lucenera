/* Layout da Memória Lucenera (SPEC-164): cabeçalho discreto + guarda de
   acesso. Sem sessão mostra o login; sem cadastro interno ativo, um aviso. */
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Plus } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { sb } from '@/lib/kb'
import Login from '@/pages/Login'
import NovaSenha from '@/pages/NovaSenha'
import { cn } from '@/lib/utils'
import { LOGO_HORIZONTAL_BRANCO } from '@/lib/marca'

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      {children}
    </div>
  )
}

export default function Layout() {
  const auth = useAuth()
  const location = useLocation()
  const [pendentes, setPendentes] = useState(0)
  const [paraRevisar, setParaRevisar] = useState(0)
  const [versaoContagem, setVersaoContagem] = useState(0)

  // A fila avisa quando muda (aprovar/rejeitar sem trocar de página).
  useEffect(() => {
    const atualizar = () => setVersaoContagem((v) => v + 1)
    window.addEventListener('kb:revisao-mudou', atualizar)
    return () => window.removeEventListener('kb:revisao-mudou', atualizar)
  }, [])

  useEffect(() => {
    if (auth.acesso !== 'liberado') return
    sb.from('inbox_items')
      .select('id', { count: 'exact', head: true })
      .in('processing_status', ['new', 'processing', 'awaiting_review', 'failed'])
      .then(({ count }) => setPendentes(count ?? 0))
    // SPEC-165: sugestões aguardando revisão (aparece para os curadores).
    sb.from('kb_sugestoes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pendente')
      .then(({ count }) => setParaRevisar(count ?? 0))
  }, [auth.acesso, location.pathname, versaoContagem])

  // Corpo em bloco de propósito: o skip.js substitui window.scrollTo por uma
  // versão que devolve Promise, e um efeito não pode devolver nada além de
  // função (o React quebra a tela ao trocar de rota).
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  if (auth.carregando)
    return (
      <Centro>
        <p className="text-muted-foreground">Carregando…</p>
      </Centro>
    )
  if (auth.recuperandoSenha) return <NovaSenha />
  if (!auth.session) return <Login />
  if (auth.acesso === 'verificando')
    return (
      <Centro>
        <p className="text-muted-foreground">Carregando…</p>
      </Centro>
    )
  if (auth.acesso !== 'liberado') {
    return (
      <Centro>
        <div className="max-w-md space-y-4">
          <h1 className="font-serif text-3xl">
            {auth.acesso === 'sem_acesso' ? 'Acesso ainda não liberado' : 'Base em atualização'}
          </h1>
          <p className="text-muted-foreground">
            {auth.acesso === 'sem_acesso'
              ? 'Sua conta não está ativa no cadastro interno da Lucenera. Fale com a equipe de TI.'
              : 'A base de conhecimento está sendo atualizada. Tente novamente em alguns minutos.'}
          </p>
          <button onClick={auth.sair} className="text-sm underline underline-offset-4">
            Sair
          </button>
        </div>
      </Centro>
    )
  }

  const link = ({ isActive }: { isActive: boolean }) =>
    cn('text-sm transition hover:text-white', isActive ? 'text-white' : 'text-white/65')

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 bg-[hsl(var(--marinho))] text-white shadow-elevation">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
          <Link to="/" className="flex items-center gap-3" aria-label="Memória Lucenera, início">
            <img src={LOGO_HORIZONTAL_BRANCO} alt="Lucenera" className="h-5 w-auto sm:h-6" />
            <span className="h-5 w-px bg-white/25" aria-hidden />
            <span className="text-sm uppercase tracking-[0.22em] text-white/80">Memória</span>
          </Link>
          <nav className="flex items-center gap-5">
            <NavLink to="/buscar" className={link}>
              Pesquisar
            </NavLink>
            {pendentes > 0 && (
              <NavLink to="/pendentes" className={link}>
                Pendentes <span className="ml-0.5 text-xs">({pendentes})</span>
              </NavLink>
            )}
            {auth.curador && paraRevisar > 0 && (
              <NavLink to="/revisao" className={link}>
                Revisão{' '}
                <span className="ml-0.5 rounded-full bg-[hsl(var(--luz-forte))] px-1.5 text-xs text-[hsl(var(--marinho))]">
                  {paraRevisar}
                </span>
              </NavLink>
            )}
            <Link
              to="/novo"
              className="hidden items-center gap-1.5 rounded-full bg-[hsl(var(--luz-forte))] px-3.5 py-1.5 text-sm font-medium text-[hsl(var(--marinho))] transition hover:brightness-110 sm:flex"
            >
              <Plus className="h-4 w-4" aria-hidden /> Inserir
            </Link>
            <button
              onClick={auth.sair}
              title={`Sair (${auth.email})`}
              className="text-white/65 hover:text-white"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="sr-only">Sair</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-24">
        <Outlet />
      </main>
      <Link
        to="/novo"
        className="fixed bottom-5 right-5 flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm text-background shadow-elevation sm:hidden"
      >
        <Plus className="h-4 w-4" aria-hidden /> Inserir
      </Link>
    </div>
  )
}

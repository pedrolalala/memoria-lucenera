/* Login com a mesma conta da Central Lucenera. Não há cadastro aberto:
   contas são criadas pelo Hub (SPEC-164). */
import { useState } from 'react'
import { sb } from '@/lib/kb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LOGO_HORIZONTAL_BRANCO, LOGO_VERTICAL_BRANCO } from '@/lib/marca'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setMsg('')
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error)
      setMsg(
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
      )
  }

  async function esqueci() {
    if (!email.trim()) {
      setMsg('Digite primeiro o e-mail da sua conta.')
      return
    }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    setMsg(
      error ? error.message : 'Enviamos um link de recuperação. Verifique também a caixa de spam.',
    )
  }

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      <section className="hidden flex-col justify-between bg-[hsl(var(--marinho))] p-12 text-white md:flex">
        <div className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--luz-forte))]">
          Memória
        </div>
        <div className="space-y-8">
          <img src={LOGO_VERTICAL_BRANCO} alt="Lucenera" className="h-32 w-auto" />
          <p className="max-w-sm text-white/70">
            O conhecimento da casa em um só lugar: como especificamos, como executamos e o que
            aprendemos em cada obra.
          </p>
        </div>
        <div className="text-xs text-white/50">A luz como matéria de arquitetura.</div>
      </section>
      <section className="flex flex-col">
        <div className="flex items-center gap-3 bg-[hsl(var(--marinho))] px-6 py-5 md:hidden">
          <img src={LOGO_HORIZONTAL_BRANCO} alt="Lucenera" className="h-6 w-auto" />
          <span className="text-xs uppercase tracking-[0.22em] text-white/80">Memória</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-8">
          <form onSubmit={entrar} className="w-full max-w-sm space-y-5">
            <div className="space-y-1">
              <h2 className="font-serif text-3xl">Entrar</h2>
              <p className="text-sm text-muted-foreground">
                Use a mesma conta da Central Lucenera.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Entrando…' : 'Entrar'}
            </Button>
            <button
              type="button"
              onClick={esqueci}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </button>
            {msg && <p className="text-sm text-foreground/80">{msg}</p>}
          </form>
        </div>
      </section>
    </div>
  )
}

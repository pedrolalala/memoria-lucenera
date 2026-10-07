/* Definição de nova senha após o link de recuperação (evento PASSWORD_RECOVERY). */
import { useState } from 'react'
import { sb } from '@/lib/kb'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function NovaSenha() {
  const { concluirRecuperacao } = useAuth()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [msg, setMsg] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmacao) {
      setMsg('As duas senhas precisam ser iguais.')
      return
    }
    setSalvando(true)
    const { error } = await sb.auth.updateUser({ password: senha })
    setSalvando(false)
    if (error) setMsg(error.message)
    else concluirRecuperacao()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <form onSubmit={salvar} className="w-full max-w-sm space-y-5">
        <h1 className="font-serif text-3xl">Nova senha</h1>
        <div className="space-y-2">
          <Label htmlFor="senha">Nova senha</Label>
          <Input
            id="senha"
            type="password"
            minLength={6}
            required
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="conf">Confirmar nova senha</Label>
          <Input
            id="conf"
            type="password"
            minLength={6}
            required
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
        {msg && <p className="text-sm">{msg}</p>}
      </form>
    </div>
  )
}

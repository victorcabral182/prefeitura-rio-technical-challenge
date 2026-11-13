import { type FormEvent, useState } from 'react'
import { ApiError, login } from './api.ts'
import { mensagemDeErro, type Usuario } from './corridas.ts'

export default function Login({ onEntrar }: { onEntrar: (usuario: Usuario) => void }) {
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // onSubmit em vez de form action: a action do React reseta o form ao terminar,
  // e um erro de senha apagaria também o e-mail digitado.
  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    setEnviando(true)
    setErro(null)
    try {
      onEntrar(await login(String(dados.get('email')).trim(), String(dados.get('senha'))))
    } catch (e) {
      setErro(e instanceof ApiError && e.status === 401 ? 'E-mail ou senha inválidos.' : mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <h1>Corridas</h1>
      <form onSubmit={entrar}>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Senha
          <input name="senha" type="password" autoComplete="current-password" required />
        </label>
        {erro && <p role="alert" className="erro">{erro}</p>}
        <button type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}

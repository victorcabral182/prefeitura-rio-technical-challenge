import { useCallback, useEffect, useState } from 'react'
import { ApiError, logout, me, refreshSession } from './api.ts'
import type { Usuario } from './corridas.ts'
import Login from './Login.tsx'
import ListaCorridas from './ListaCorridas.tsx'
import CriarCorrida from './CriarCorrida.tsx'

export default function App() {
  // undefined = ainda tentando restaurar a sessão; null = deslogado.
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined)
  const [tela, setTela] = useState<'lista' | 'criar'>('lista')

  // Ao abrir ou recarregar a página, o token em memória não existe mais: tenta
  // o refresh pelo cookie antes de mostrar o login.
  useEffect(() => {
    refreshSession()
      .then((ok) => (ok ? me() : null))
      .then(setUsuario, () => setUsuario(null))
  }, [])

  // Sessão expirada (o refresh também falhou): volta para o login. Devolve true
  // se tratou o erro, para a tela não mostrar a mensagem.
  const onErro = useCallback((erro: unknown) => {
    if (!(erro instanceof ApiError && erro.status === 401)) return false
    setUsuario(null)
    setTela('lista')
    return true
  }, [])

  if (usuario === undefined) return null
  if (!usuario) return <Login onEntrar={setUsuario} />

  async function sair() {
    await logout()
    setUsuario(null)
    setTela('lista')
  }

  return (
    <>
      <header>
        <strong>Corridas</strong>
        <span>
          {usuario.name} ({usuario.type}) <button onClick={() => void sair()}>Sair</button>
        </span>
      </header>
      <main>
        {tela === 'lista' ? (
          <ListaCorridas usuario={usuario} onNova={() => setTela('criar')} onErro={onErro} />
        ) : (
          <CriarCorrida onCriada={() => setTela('lista')} onCancelar={() => setTela('lista')} onErro={onErro} />
        )}
      </main>
    </>
  )
}

import { useState } from 'react'
import type { Corrida } from './corridas.ts'
import Login from './Login.tsx'
import ListaCorridas from './ListaCorridas.tsx'
import CriarCorrida from './CriarCorrida.tsx'

// Dados em memória só para diagramar as telas; a integração troca por chamadas à API.
const EXEMPLO: Corrida[] = [
  {
    id: '1',
    origem: 'Praça Mauá',
    destino: 'Aeroporto Santos Dumont',
    status: 'em_andamento',
    criadaEm: '2026-11-11T14:10:00Z',
  },
  {
    id: '2',
    origem: 'Largo do Machado',
    destino: 'Maracanã',
    status: 'finalizada',
    criadaEm: '2026-11-10T21:30:00Z',
  },
]

export default function App() {
  const [email, setEmail] = useState<string | null>(null)
  const [tela, setTela] = useState<'lista' | 'criar'>('lista')
  const [corridas, setCorridas] = useState(EXEMPLO)

  // Tela pública: sem login só existe o login. Por enquanto qualquer e-mail e senha entram.
  if (!email) return <Login onEntrar={(email) => setEmail(email)} />

  function criar(origem: string, destino: string) {
    const nova: Corrida = {
      id: crypto.randomUUID(),
      origem,
      destino,
      status: 'solicitada',
      criadaEm: new Date().toISOString(),
    }
    setCorridas([nova, ...corridas])
    setTela('lista')
  }

  function sair() {
    setEmail(null)
    setTela('lista')
  }

  return (
    <>
      <header>
        <strong>Corridas</strong>
        <button onClick={sair}>Sair</button>
      </header>
      <main>
        {tela === 'lista' ? (
          <ListaCorridas corridas={corridas} onNova={() => setTela('criar')} />
        ) : (
          <CriarCorrida onCriar={criar} onCancelar={() => setTela('lista')} />
        )}
      </main>
    </>
  )
}

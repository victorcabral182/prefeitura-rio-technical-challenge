import { useCallback, useEffect, useState } from 'react'
import { alterarStatus, listarCorridas } from './api.ts'
import { type Corrida, mensagemDeErro, PROXIMA_ACAO, STATUS_LABEL, type Usuario } from './corridas.ts'

// Os status mudam por ação do outro lado (motorista aceita, passageiro cria).
const POLLING_MS = 5000

export default function ListaCorridas({
  usuario,
  onNova,
  onErro,
}: {
  usuario: Usuario
  onNova: () => void
  onErro: (erro: unknown) => boolean
}) {
  const [corridas, setCorridas] = useState<Corrida[] | null>(null)
  // Separados: o polling limpa o próprio erro a cada carga, mas não pode apagar
  // a mensagem de uma ação que falhou (ex.: 409) antes de o usuário ler.
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  const carregar = useCallback(
    () =>
      listarCorridas()
        .then((lista) => {
          setCorridas(lista)
          setErroCarga(null)
        })
        .catch((e: unknown) => {
          if (!onErro(e)) setErroCarga(mensagemDeErro(e))
        }),
    [onErro],
  )

  // Só consulta com a aba visível: aba em segundo plano não gera carga na api.
  useEffect(() => {
    void carregar()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void carregar()
    }, POLLING_MS)
    return () => clearInterval(timer)
  }, [carregar])

  async function avancar(corrida: Corrida) {
    const acao = PROXIMA_ACAO[corrida.status]
    if (!acao) return
    setOcupada(corrida.id)
    setErroAcao(null)
    try {
      await alterarStatus(corrida.id, acao.status)
      await carregar()
    } catch (e) {
      // 409: fora de ordem ou motorista já com corrida ativa; a mensagem vem da api.
      if (!onErro(e)) setErroAcao(mensagemDeErro(e))
    } finally {
      setOcupada(null)
    }
  }

  // Motorista aceita qualquer aberta; iniciar e finalizar só as que são dele.
  const podeAvancar = (c: Corrida) =>
    usuario.type === 'motorista' && PROXIMA_ACAO[c.status] && (c.status === 'solicitada' || c.motoristaId === usuario.id)

  return (
    <>
      <div className="titulo">
        <h1>Corridas</h1>
        {usuario.type === 'passageiro' && <button onClick={onNova}>Nova corrida</button>}
      </div>
      {erroCarga && <p role="alert" className="erro">{erroCarga}</p>}
      {erroAcao && <p role="alert" className="erro">{erroAcao}</p>}
      {corridas === null ? (
        <p>Carregando…</p>
      ) : corridas.length === 0 ? (
        <p>{usuario.type === 'passageiro' ? 'Nenhuma corrida ainda.' : 'Nenhuma corrida aberta.'}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Origem</th>
              <th>Destino</th>
              <th>Status</th>
              <th>Solicitada em</th>
              {usuario.type === 'motorista' && <th />}
            </tr>
          </thead>
          <tbody>
            {corridas.map((c) => (
              <tr key={c.id}>
                <td>{c.origem}</td>
                <td>{c.destino}</td>
                <td>
                  <span className="status">{STATUS_LABEL[c.status]}</span>
                </td>
                <td>{new Date(c.criadaEm).toLocaleString('pt-BR')}</td>
                {usuario.type === 'motorista' && (
                  <td>
                    {podeAvancar(c) && (
                      <button onClick={() => void avancar(c)} disabled={ocupada !== null}>
                        {PROXIMA_ACAO[c.status]?.label}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

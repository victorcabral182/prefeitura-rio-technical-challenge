import { type FormEvent, useRef, useState } from 'react'
import { criarCorrida } from './api.ts'
import { mensagemDeErro } from './corridas.ts'

export default function CriarCorrida({
  onCriada,
  onCancelar,
  onErro,
}: {
  onCriada: () => void
  onCancelar: () => void
  onErro: (erro: unknown) => boolean
}) {
  // Uma chave por intenção: reenviar o mesmo pedido depois de erro ou timeout
  // reaproveita a chave e a api devolve a mesma corrida em vez de criar outra.
  // Editar o form muda o pedido, então gera chave nova (a mesma chave com outro
  // corpo dá 422). Depois do sucesso a tela fecha, e a próxima abre com chave nova.
  const chave = useRef(crypto.randomUUID())
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // onSubmit em vez de form action: a action reseta o form ao terminar, e o
  // usuário perderia o que digitou num erro.
  async function solicitar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    setEnviando(true)
    setErro(null)
    try {
      await criarCorrida(String(dados.get('origem')).trim(), String(dados.get('destino')).trim(), chave.current)
      onCriada()
    } catch (e) {
      if (!onErro(e)) setErro(mensagemDeErro(e))
      setEnviando(false)
    }
  }

  return (
    <>
      <h1>Nova corrida</h1>
      <form onSubmit={solicitar} onChange={() => (chave.current = crypto.randomUUID())}>
        <label>
          Origem
          <input name="origem" required maxLength={255} />
        </label>
        <label>
          Destino
          <input name="destino" required maxLength={255} />
        </label>
        {erro && <p role="alert" className="erro">{erro}</p>}
        <div className="acoes">
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" disabled={enviando}>
            {enviando ? 'Solicitando…' : 'Solicitar corrida'}
          </button>
        </div>
      </form>
    </>
  )
}

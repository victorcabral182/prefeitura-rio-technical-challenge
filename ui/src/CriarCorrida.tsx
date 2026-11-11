export default function CriarCorrida({
  onCriar,
  onCancelar,
}: {
  onCriar: (origem: string, destino: string) => void
  onCancelar: () => void
}) {
  return (
    <>
      <h1>Nova corrida</h1>
      <form
        action={(dados) =>
          onCriar(String(dados.get('origem')).trim(), String(dados.get('destino')).trim())
        }
      >
        <label>
          Origem
          <input name="origem" required />
        </label>
        <label>
          Destino
          <input name="destino" required />
        </label>
        <div className="acoes">
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit">Solicitar corrida</button>
        </div>
      </form>
    </>
  )
}

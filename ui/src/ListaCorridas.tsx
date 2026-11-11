import { STATUS_LABEL, type Corrida } from './corridas.ts'

export default function ListaCorridas({
  corridas,
  onNova,
}: {
  corridas: Corrida[]
  onNova: () => void
}) {
  return (
    <>
      <div className="titulo">
        <h1>Corridas</h1>
        <button onClick={onNova}>Nova corrida</button>
      </div>
      {corridas.length === 0 ? (
        <p>Nenhuma corrida ainda.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Origem</th>
              <th>Destino</th>
              <th>Status</th>
              <th>Solicitada em</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

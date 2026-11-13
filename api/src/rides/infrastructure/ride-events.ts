// Routing keys no exchange `corridas` (rabbitmq/definitions.json liga `corrida.*`
// à fila do worker). O worker repete estes nomes: contrato duplicado de propósito
// (DECISIONS.md, entrada 1).
export const RIDE_CREATED = 'corrida.criada';
export const RIDE_STATUS_CHANGED = 'corrida.status_alterado';

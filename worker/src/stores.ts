import type { Redis } from 'ioredis';
import mongoose from 'mongoose';
import type { Stores } from './handle-message.ts';

// Histórico append-only: um documento por evento, _id = eventId (deduplicação).
const historySchema = new mongoose.Schema(
  {
    _id: String,
    corridaId: { type: String, required: true },
    tipo: { type: String, required: true },
    status: { type: String, required: true },
    versao: { type: Number, required: true },
    ocorridoEm: { type: Date, required: true },
    correlationId: String,
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { collection: 'historico_corridas', versionKey: false },
);
// Linha do tempo de uma corrida.
historySchema.index({ corridaId: 1, versao: 1 });

export const History = mongoose.model('HistoricoCorrida', historySchema);

const DUPLICATE_KEY = 11000;

// Compare-and-set atômico no Redis: grava o snapshot só se a versão for maior
// que a do cache. Evento repetido ou fora de ordem não sobrescreve o mais novo.
// KEYS[1] = chave, ARGV[1] = snapshot JSON, ARGV[2] = versão.
const SET_IF_NEWER = `
local current = redis.call('GET', KEYS[1])
if current and cjson.decode(current).versao >= tonumber(ARGV[2]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1])
return 1`;

// Mesma chave que a api lê (rideCacheKey em api/src/rides/infrastructure).
export const rideCacheKey = (id: string): string => `corrida:${id}`;

export function createStores(redis: Redis): Stores {
  return {
    async saveHistory(event, correlationId) {
      try {
        await History.create({
          _id: event.eventId,
          corridaId: event.data.id,
          tipo: event.type,
          status: event.data.status,
          versao: event.data.versao,
          ocorridoEm: new Date(event.occurredAt),
          correlationId,
          snapshot: event.data,
        });
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === DUPLICATE_KEY) return false;
        throw error;
      }
    },
    async saveCache(snapshot) {
      const key = rideCacheKey(snapshot.id);
      return (await redis.eval(SET_IF_NEWER, 1, key, JSON.stringify(snapshot), snapshot.versao)) === 1;
    },
  };
}

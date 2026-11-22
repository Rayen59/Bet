import { EventEmitter } from 'node:events';

class RealtimeHub extends EventEmitter {
  emitMatchesUpdated(payload: { liveTotal?: number; synced?: number; updated?: number } = {}) {
    this.emit('matches_updated', { ...payload, ts: Date.now() });
  }

  emitUserBalanceUpdated(userId: number, newBalance: number, reason: string) {
    this.emit('balance_updated', { userId, newBalance, reason, ts: Date.now() });
  }

  emitDepositRequested(payload: { userId: number; username: string; amount: number; reference: string }) {
    this.emit('deposit_requested', { ...payload, ts: Date.now() });
  }
}

export const realtimeHub = new RealtimeHub();
realtimeHub.setMaxListeners(200);

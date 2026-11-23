import { EventEmitter } from 'node:events';

class RealtimeHub extends EventEmitter {
  emitMatchesUpdated(payload: { liveTotal?: number; synced?: number; updated?: number } = {}) {
    this.emit('matches_updated', { ...payload, ts: Date.now() });
  }

  emitUserBalanceUpdated(userId: number, newBalance: number, reason: string) {
    this.emit('balance_updated', { userId, newBalance, reason, ts: Date.now() });
  }

  emitDepositRequested(payload: {
    depositId?: number;
    userId: number;
    username: string;
    method?: string;
    operator?: string;
    amount: number;
    reference?: string;
  }) {
    this.emit('deposit_requested', { ...payload, ts: Date.now() });
  }

  emitDepositUpdated(payload: {
    depositId: number;
    userId: number;
    status: 'approved' | 'rejected';
    amount: number;
    adminNote?: string | null;
    newBalance?: number;
  }) {
    this.emit('deposit_updated', { ...payload, ts: Date.now() });
  }

  emitMessageReceived(payload: {
    id: number;
    userId: number;
    senderId: number;
    senderRole: 'user' | 'admin';
    senderName: string;
    message: string;
    createdAt: string | Date;
  }) {
    this.emit('message_received', { ...payload, ts: Date.now() });
  }
}

export const realtimeHub = new RealtimeHub();
realtimeHub.setMaxListeners(200);


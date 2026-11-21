import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/useAuthStore';
import type {
  ChatMessage,
  PlaybackSnapshot,
  PresenceSnapshot,
  QueueItem,
} from '../types/social';

export interface JoinRoomAck {
  ok: boolean;
  message?: string;
  presence?: PresenceSnapshot;
  playback?: PlaybackSnapshot;
  messages?: ChatMessage[];
  queue?: QueueItem[];
}

class SocketService {
  private socket: Socket | null = null;
  private currentRoomCode: string | null = null;

  connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const { socketUrl, token } = useAuthStore.getState();

    this.socket = io(socketUrl, {
      auth: { token: token || '' },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO connected to backend:', this.socket?.id);
      if (this.currentRoomCode) {
        this.joinRoom(this.currentRoomCode);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  async joinRoom(roomCode: string): Promise<JoinRoomAck> {
    const s = this.connect();
    this.currentRoomCode = roomCode;

    return new Promise((resolve) => {
      s.emit('room:join', { roomCode }, (ack: JoinRoomAck) => {
        resolve(ack || { ok: false, message: 'No acknowledgment received from server' });
      });
    });
  }

  leaveRoom(roomCode: string): void {
    if (this.socket) {
      this.socket.emit('room:leave', { roomCode });
    }
    this.currentRoomCode = null;
  }

  async sendChatMessage(roomCode: string, content: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.socket) return { ok: false, message: 'Socket not connected' };

    return new Promise((resolve) => {
      this.socket?.emit('chat:send', { roomCode, content }, (ack: { ok: boolean; message?: string }) => {
        resolve(ack || { ok: false, message: 'Failed to send message' });
      });
    });
  }

  async setPlayback(roomCode: string, track: {
    videoId: string;
    title: string;
    thumbnailUrl: string;
    duration: string;
  }): Promise<{ ok: boolean; playback?: PlaybackSnapshot; message?: string }> {
    if (!this.socket) return { ok: false, message: 'Socket not connected' };

    return new Promise((resolve) => {
      this.socket?.emit('playback:set', { roomCode, track }, (ack: { ok: boolean; playback?: PlaybackSnapshot; message?: string }) => {
        resolve(ack || { ok: false, message: 'Playback set failed' });
      });
    });
  }

  async controlPlayback(roomCode: string, action: 'play' | 'pause' | 'seek', position?: number): Promise<{ ok: boolean; playback?: PlaybackSnapshot }> {
    if (!this.socket) return { ok: false };

    return new Promise((resolve) => {
      this.socket?.emit('playback:control', { roomCode, action, position }, (ack: { ok: boolean; playback?: PlaybackSnapshot }) => {
        resolve(ack || { ok: false });
      });
    });
  }

  async addToQueue(roomCode: string, track: QueueItem): Promise<{ ok: boolean; queue?: QueueItem[]; code?: string }> {
    if (!this.socket) return { ok: false };

    return new Promise((resolve) => {
      this.socket?.emit('queue:add', { roomCode, track }, (ack: { ok: boolean; queue?: QueueItem[]; code?: string }) => {
        resolve(ack || { ok: false });
      });
    });
  }

  async removeFromQueue(roomCode: string, index: number): Promise<{ ok: boolean; queue?: QueueItem[] }> {
    if (!this.socket) return { ok: false };

    return new Promise((resolve) => {
      this.socket?.emit('queue:remove', { roomCode, index }, (ack: { ok: boolean; queue?: QueueItem[] }) => {
        resolve(ack || { ok: false });
      });
    });
  }

  async transferHost(roomCode: string, userId: string): Promise<{ ok: boolean; message?: string }> {
    if (!this.socket) return { ok: false, message: 'Socket not connected' };

    return new Promise((resolve) => {
      this.socket?.emit('host:transfer', { roomCode, userId }, (ack: { ok: boolean; message?: string }) => {
        resolve(ack || { ok: false });
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentRoomCode = null;
  }
}

export const socketService = new SocketService();


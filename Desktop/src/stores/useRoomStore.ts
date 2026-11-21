import { create } from 'zustand';
import { apiClient } from '../services/apiClient';
import { socketService } from '../services/socketService';
import { useAuthStore } from './useAuthStore';
import { useAppStore } from './useAppStore';
import { soundService } from '../services/soundService';
import type {
  ChatMessage,
  PlaybackSnapshot,
  PresenceSnapshot,
  QueueItem,
  RoomDTO,
  RoomMember,
  HostPendingPayload,
  HostUpdatePayload,
} from '../types/social';

interface RoomState {
  activeRoom: RoomDTO | null;
  members: RoomMember[];
  hostUserId: string | null;
  isHost: boolean;
  chatMessages: ChatMessage[];
  queue: QueueItem[];
  playback: PlaybackSnapshot | null;
  isConnected: boolean;
  isLoading: boolean;
  hostPendingDeadline: string | null;
  error: string | null;

  createAndJoinRoom: () => Promise<string>;
  joinRoom: (roomCode: string, isFromCreate?: boolean) => Promise<boolean>;
  leaveRoom: () => Promise<void>;
  sendChat: (content: string) => Promise<boolean>;
  setTrack: (track: { videoId: string; title: string; thumbnailUrl: string; duration: string }) => Promise<void>;
  controlPlayback: (action: 'play' | 'pause' | 'seek', position?: number) => Promise<void>;
  addToQueue: (track: QueueItem) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  playNextInQueue: () => Promise<void>;
  transferHost: (userId: string) => Promise<void>;
  bindSocketEvents: () => () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  activeRoom: null,
  members: [],
  hostUserId: null,
  isHost: false,
  chatMessages: [],
  queue: [],
  playback: null,
  isConnected: false,
  isLoading: false,
  hostPendingDeadline: null,
  error: null,

  createAndJoinRoom: async () => {
    set({ isLoading: true, error: null });
    try {
      const room = await apiClient.createRoom();
      set({ activeRoom: room });
      soundService.play('room:create');
      await get().joinRoom(room.roomCode, true);
      return room.roomCode;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  joinRoom: async (roomCode: string, isFromCreate?: boolean) => {
    const cleanCode = roomCode.trim().toUpperCase();
    set({ isLoading: true, error: null });

    try {
      // 1. Join room via REST (validates membership in DB)
      const room = await apiClient.joinRoom(cleanCode);
      set({ activeRoom: room });

      // 2. Establish Socket.IO real-time connection
      const ack = await socketService.joinRoom(cleanCode);

      if (ack.ok) {
        const currentUser = useAuthStore.getState().user;
        const hostId = ack.presence?.hostUserId || room.host.id;
        const isHost = Boolean(currentUser && currentUser.id === hostId);

        set({
          isConnected: true,
          isLoading: false,
          members: ack.presence?.members || [],
          hostUserId: hostId,
          isHost,
          playback: ack.playback || null,
          chatMessages: ack.messages || [],
          queue: ack.queue || [],
        });
        if (!isFromCreate) {
          soundService.play('room:join');
        }
        return true;
      } else {
        set({ error: ack.message || 'Failed to join real-time room session', isLoading: false });
        return false;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, isLoading: false });
      return false;
    }
  },

  leaveRoom: async () => {
    const { activeRoom } = get();
    if (!activeRoom) return;
    const roomCode = activeRoom.roomCode;

    soundService.play('room:leave');

    // 1. Optimistic UI reset: clear room state immediately in memory so UI reacts instantly
    set({
      activeRoom: null,
      members: [],
      hostUserId: null,
      isHost: false,
      chatMessages: [],
      queue: [],
      playback: null,
      isConnected: false,
      hostPendingDeadline: null,
    });

    // 2. Background cleanup: emit socket leave & notify backend REST without blocking the UI
    try {
      socketService.leaveRoom(roomCode);
      await apiClient.leaveRoom(roomCode);
    } catch (err) {
      console.warn('Background room departure sync error:', err);
    }
  },

  sendChat: async (content: string) => {
    const { activeRoom } = get();
    if (!activeRoom || !content.trim()) return false;

    const res = await socketService.sendChatMessage(activeRoom.roomCode, content.trim());
    return res.ok;
  },

  setTrack: async (track) => {
    const { activeRoom, isHost } = get();
    if (!activeRoom || !isHost) return;

    const res = await socketService.setPlayback(activeRoom.roomCode, track);
    if (res.ok && res.playback) {
      set({ playback: res.playback });
    }
  },

  controlPlayback: async (action, position) => {
    const { activeRoom, isHost } = get();
    if (!activeRoom || !isHost) return;

    const res = await socketService.controlPlayback(activeRoom.roomCode, action, position);
    if (res.ok && res.playback) {
      set({ playback: res.playback });
    }
  },

  addToQueue: async (track) => {
    const { activeRoom, isHost } = get();
    if (!activeRoom || !isHost) return;

    const res = await socketService.addToQueue(activeRoom.roomCode, track);
    if (res.ok && res.queue) {
      set({ queue: res.queue });
    }
  },

  removeFromQueue: async (index) => {
    const { activeRoom, isHost } = get();
    if (!activeRoom || !isHost) return;

    const res = await socketService.removeFromQueue(activeRoom.roomCode, index);
    if (res.ok && res.queue) {
      soundService.play('action:delete');
      set({ queue: res.queue });
    }
  },

  playNextInQueue: async () => {
    const { activeRoom, isHost, queue } = get();
    if (!activeRoom || !isHost || queue.length === 0) return;

    const nextTrack = queue[0];
    await get().removeFromQueue(0);
    await get().setTrack({
      videoId: nextTrack.videoId,
      title: nextTrack.title,
      thumbnailUrl: nextTrack.thumbnailUrl,
      duration: String(nextTrack.duration),
    });
  },

  transferHost: async (userId) => {
    const { activeRoom, isHost } = get();
    if (!activeRoom || !isHost) return;

    await socketService.transferHost(activeRoom.roomCode, userId);
  },

  bindSocketEvents: () => {
    const socket = socketService.connect();

    const onPresenceUpdate = (snapshot: PresenceSnapshot) => {
      const currentUser = useAuthStore.getState().user;
      const isHost = Boolean(currentUser && currentUser.id === snapshot.hostUserId);
      set({
        members: snapshot.members,
        hostUserId: snapshot.hostUserId,
        isHost,
        hostPendingDeadline: null,
      });
    };

    const onPlaybackUpdate = (playback: PlaybackSnapshot) => {
      set({ playback });
    };

    const onQueueUpdate = (queue: QueueItem[]) => {
      set({ queue });
    };

    const onChatNew = (message: ChatMessage) => {
      set((state) => ({
        chatMessages: [...state.chatMessages, message],
      }));

      // Edge case 1:A - Incoming messages only + mute if chat drawer is actively open
      const currentUser = useAuthStore.getState().user;
      const isFromOtherUser = currentUser ? message.userId !== currentUser.id : true;
      const { isDrawerOpen, drawerTab } = useAppStore.getState();
      const isChatActive = isDrawerOpen && drawerTab === 'chat';

      if (isFromOtherUser && !isChatActive) {
        soundService.play('notification:chat');
      }
    };

    const onHostPending = (payload: HostPendingPayload) => {
      set({ hostPendingDeadline: payload.deadline });
    };

    const onHostUpdate = (payload: HostUpdatePayload) => {
      const currentUser = useAuthStore.getState().user;
      set({
        hostUserId: payload.hostUserId,
        isHost: Boolean(currentUser && currentUser.id === payload.hostUserId),
        hostPendingDeadline: null,
      });
    };

    socket.on('presence:update', onPresenceUpdate);
    socket.on('playback:update', onPlaybackUpdate);
    socket.on('queue:update', onQueueUpdate);
    socket.on('chat:new', onChatNew);
    socket.on('host:pending', onHostPending);
    socket.on('host:update', onHostUpdate);

    return () => {
      socket.off('presence:update', onPresenceUpdate);
      socket.off('playback:update', onPlaybackUpdate);
      socket.off('queue:update', onQueueUpdate);
      socket.off('chat:new', onChatNew);
      socket.off('host:pending', onHostPending);
      socket.off('host:update', onHostUpdate);
    };
  },
}));


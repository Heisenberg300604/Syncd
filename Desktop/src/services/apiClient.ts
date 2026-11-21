import { useAuthStore } from '../stores/useAuthStore';
import type { RoomDTO } from '../types/social';

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private getBaseUrl(): string {
    return useAuthStore.getState().apiUrl;
  }

  async createRoom(): Promise<RoomDTO> {
    const res = await fetch(`${this.getBaseUrl()}/rooms`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create room (${res.status})`);
    }

    const data = await res.json();
    return data.room;
  }

  async getRoom(roomCode: string): Promise<RoomDTO> {
    const res = await fetch(`${this.getBaseUrl()}/rooms/${roomCode}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to fetch room (${res.status})`);
    }

    const data = await res.json();
    return data.room;
  }

  async joinRoom(roomCode: string): Promise<RoomDTO> {
    const res = await fetch(`${this.getBaseUrl()}/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to join room (${res.status})`);
    }

    const data = await res.json();
    return data.room;
  }

  async leaveRoom(roomCode: string): Promise<{ left: boolean; roomDeleted: boolean }> {
    const res = await fetch(`${this.getBaseUrl()}/rooms/${roomCode}/leave`, {
      method: 'POST',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to leave room (${res.status})`);
    }

    return await res.json();
  }

  async searchYouTube(query: string): Promise<Array<{
    videoId: string;
    title: string;
    thumbnailUrl: string;
    duration: string;
  }>> {
    const res = await fetch(`${this.getBaseUrl()}/music/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.results || [];
  }

  async exchangeDesktopCode(code: string): Promise<{
    ok: boolean;
    token: string;
    user: { id: string; clerkUserId: string; username: string } | null;
  }> {
    const res = await fetch(`${this.getBaseUrl()}/auth/desktop-exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Failed to exchange code (${res.status})`);
    }

    return await res.json();
  }
}

export const apiClient = new ApiClient();


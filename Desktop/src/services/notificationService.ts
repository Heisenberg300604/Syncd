/**
 * SyncDesk Notification Service
 * Manages desktop notifications for track changes and playback events.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    try {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
      return false;
    }
  }
  return false;
}

export function canSendNotification(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

interface TrackNotificationPayload {
  title: string;
  artist?: string;
  album?: string;
  artworkUrl?: string;
  force?: boolean; // If true, bypasses the background/minimized check (e.g. for test notifications)
}

export function showTrackNotification({
  title,
  artist,
  album,
  artworkUrl,
  force = false,
}: TrackNotificationPayload): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  // If not forcing (test), only send notification when the window is in background / minimized
  if (!force && typeof document !== 'undefined' && document.hasFocus && document.hasFocus()) {
    return false;
  }

  if (Notification.permission !== 'granted') {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          showTrackNotification({ title, artist, album, artworkUrl, force });
        }
      });
    }
    return false;
  }

  try {
    const subtitle = [artist, album].filter(Boolean).join(' • ') || 'SyncDesk';
    const notification = new Notification(title, {
      body: subtitle,
      icon: artworkUrl || '/favicon.ico',
      silent: true,
      tag: 'syncd-track-notification',
    });

    // Automatically close notification after 4.5 seconds to avoid tray accumulation
    setTimeout(() => {
      try {
        notification.close();
      } catch {
        // quiet fallback
      }
    }, 4500);

    return true;
  } catch (err) {
    console.warn('Error showing track notification:', err);
    return false;
  }
}

export function isDeviceOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 1000 / 60;

  return diffMinutes <= 2; // Online if last seen within 2 minutes
}

export function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Never';

  const lastSeenDate = new Date(lastSeen);
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - lastSeenDate.getTime()) / 1000);

  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  } else if (diffSeconds < 3600) {
    const minutes = Math.floor(diffSeconds / 60);
    return `${minutes}m ago`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diffSeconds / 86400);
    return `${days}d ago`;
  }
}
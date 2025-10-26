/**
 * Format an ISO datetime string to local timezone display
 */
export function formatLocalDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format an ISO datetime string to a short local time display
 */
export function formatLocalTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format an ISO datetime string to a short local date display
 */
export function formatLocalDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Convert a local datetime input value to ISO string
 */
export function localToISOString(localDateTimeString: string): string {
  return new Date(localDateTimeString).toISOString();
}

/**
 * Convert ISO string to local datetime-local input value
 */
export function isoToLocalInputValue(isoString: string): string {
  const date = new Date(isoString);
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Get current datetime as local input value
 */
export function getCurrentLocalInputValue(): string {
  return isoToLocalInputValue(new Date().toISOString());
}

/**
 * Add hours to current time and return as local input value
 */
export function getLocalInputValuePlusHours(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return isoToLocalInputValue(date.toISOString());
}

/**
 * Check if an override is currently active
 */
export function isOverrideActive(startTime: string, endTime: string): boolean {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  return now >= start && now <= end;
}

/**
 * Check if an override is in the past
 */
export function isOverridePast(endTime: string): boolean {
  return new Date(endTime) < new Date();
}

/**
 * Check if an override is in the future
 */
export function isOverrideFuture(startTime: string): boolean {
  return new Date(startTime) > new Date();
}

/**
 * Format duration between two ISO strings
 */
export function formatDurationBetween(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}
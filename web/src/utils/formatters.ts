/**
 * Format currency with proper locale and precision
 * @param amount - Amount in USD
 * @returns Formatted string (e.g., "$1,234.56")
 */
export function formatCurrency(amount: number): string {
  // Handle undefined/null/NaN
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format duration in seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "24h 30m", "5d 3h", "45m")
 */
export function formatDuration(seconds: number): string {
  // Handle undefined/null/NaN
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return '0s';
  }

  if (seconds < 60) return `${Math.floor(seconds)}s`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days < 7) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;
  if (weeks < 4) {
    return remainingDays > 0 ? `${weeks}w ${remainingDays}d` : `${weeks}w`;
  }

  const months = Math.floor(days / 30);
  const remainingDaysInMonth = days % 30;
  return remainingDaysInMonth > 0 ? `${months}mo ${Math.floor(remainingDaysInMonth)}d` : `${months}mo`;
}

/**
 * Format kWh with appropriate precision
 * @param kwh - Energy in kWh
 * @returns Formatted string (e.g., "123.5 kWh", "1,234 kWh")
 */
export function formatEnergy(kwh: number): string {
  // Handle undefined/null/NaN
  if (kwh === undefined || kwh === null || isNaN(kwh)) {
    return '0.00 kWh';
  }

  if (kwh < 10) {
    return `${kwh.toFixed(2)} kWh`;
  } else if (kwh < 100) {
    return `${kwh.toFixed(1)} kWh`;
  } else if (kwh < 1000) {
    return `${Math.round(kwh)} kWh`;
  } else {
    // Format with commas for large numbers
    return `${new Intl.NumberFormat('en-US').format(Math.round(kwh))} kWh`;
  }
}

/**
 * Format percentage with proper precision
 * @param value - Value to format as percentage
 * @param decimals - Number of decimal places (default 1)
 * @returns Formatted string (e.g., "12.5%")
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  // Handle undefined/null/NaN
  if (value === undefined || value === null || isNaN(value)) {
    return '0%';
  }
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers with abbreviations
 * @param num - Number to format
 * @returns Formatted string (e.g., "1.2K", "3.5M")
 */
export function formatLargeNumber(num: number): string {
  // Handle undefined/null/NaN
  if (num === undefined || num === null || isNaN(num)) {
    return '0';
  }

  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
}
/**
 * Calculate relative wind direction
 * @param windDegrees - Absolute wind direction (0-360, North = 0)
 * @param bunkerOrientation - Bunker orientation (0-360, North = 0)
 * @returns Relative wind direction in degrees
 */
export function calculateRelativeWind(
  windDegrees: number,
  bunkerOrientation: number
): number {
  let relative = windDegrees - bunkerOrientation;

  // Normalize to 0-360 range
  if (relative < 0) relative += 360;
  if (relative >= 360) relative -= 360;

  return relative;
}

/**
 * Convert degrees to cardinal direction
 * @param degrees - Direction in degrees (0-360)
 * @returns Cardinal direction (N, NE, E, SE, S, SW, W, NW)
 */
export function degreesToCardinal(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Convert degrees to 16-point cardinal direction
 * @param degrees - Direction in degrees (0-360)
 * @returns 16-point cardinal direction
 */
export function degreesToCardinal16(degrees: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE',
    'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW',
    'W', 'WNW', 'NW', 'NNW'
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

/**
 * Check if wind conditions exceed threshold criteria for fan activation
 * @param windSpeed - Current wind speed in mph
 * @param windDirection - Wind direction in degrees
 * @param bunkerOrientation - Bunker orientation in degrees
 * @param threshold - Wind speed threshold in mph
 * @returns True if wind conditions trigger automatic fan activation
 *
 * IMPORTANT BUSINESS LOGIC:
 * - When wind speed >= threshold: Fans TURN ON automatically (optimal ventilation conditions)
 * - When wind speed < threshold: Fans CAN BE turned off (insufficient wind for ventilation)
 *
 * The logic is that high winds provide optimal conditions for grain ventilation.
 * When wind exceeds the threshold, fans activate to maximize airflow through the bunker.
 * When wind is below threshold, fans can be turned off to conserve energy.
 */
export function exceedsWindConditionCriteria(
  windSpeed: number,
  windDirection: number,
  bunkerOrientation: number,
  threshold: number
): boolean {
  // For now, just check if wind speed meets threshold
  // In future, could also consider direction relative to bunker
  return windSpeed >= threshold;
}

// Keep old function names for backward compatibility but mark as deprecated
/**
 * @deprecated Use exceedsWindConditionCriteria instead
 */
export const meetsVentilationCriteria = exceedsWindConditionCriteria;

/**
 * @deprecated Use exceedsWindConditionCriteria instead
 */
export const meetsShutdownCriteria = exceedsWindConditionCriteria;

/**
 * Format wind speed for display
 * @param speed - Wind speed in mph
 * @returns Formatted string with 1 decimal place
 */
export function formatWindSpeed(speed: number): string {
  // Handle undefined/null/NaN
  if (speed === undefined || speed === null || isNaN(speed)) {
    return '0.0 mph';
  }
  return `${speed.toFixed(1)} mph`;
}

/**
 * Get wind arrow color based on threshold
 * @param windSpeed - Current wind speed
 * @param threshold - Threshold speed
 * @returns Tailwind color class
 */
export function getWindStatusColor(windSpeed: number, threshold: number): string {
  return windSpeed >= threshold ? 'text-red-600' : 'text-yellow-600';
}
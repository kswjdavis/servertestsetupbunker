export function validateGlobalConfig(config: any): Record<string, string> {
  const errors: Record<string, string> = {};

  // Wind threshold validation
  if (!config.default_wind_threshold_mph || config.default_wind_threshold_mph <= 0) {
    errors.default_wind_threshold_mph = 'Wind threshold must be greater than 0';
  } else if (config.default_wind_threshold_mph > 100) {
    errors.default_wind_threshold_mph = 'Wind threshold seems unreasonably high';
  }

  // Electricity cost validation
  if (!config.default_electricity_cost_kwh || config.default_electricity_cost_kwh <= 0) {
    errors.default_electricity_cost_kwh = 'Electricity cost must be greater than 0';
  } else if (config.default_electricity_cost_kwh > 10) {
    errors.default_electricity_cost_kwh = 'Electricity cost seems unreasonably high';
  }

  // Fan power validation
  if (!config.default_fan_power_watts || config.default_fan_power_watts <= 0) {
    errors.default_fan_power_watts = 'Fan power must be greater than 0';
  } else if (config.default_fan_power_watts > 10000) {
    errors.default_fan_power_watts = 'Fan power seems unreasonably high';
  }

  // Weather station ID validation (4-letter ICAO code)
  if (!config.weather_station_id) {
    errors.weather_station_id = 'Weather station ID is required';
  } else if (!/^[A-Z]{4}$/.test(config.weather_station_id)) {
    errors.weather_station_id = 'Station ID must be 4 uppercase letters (e.g., KOKC)';
  }

  // Poll interval validation
  if (config.weather_poll_interval_seconds < 10) {
    errors.weather_poll_interval_seconds = 'Poll interval must be at least 10 seconds';
  } else if (config.weather_poll_interval_seconds > 3600) {
    errors.weather_poll_interval_seconds = 'Poll interval should not exceed 1 hour';
  }

  // Broadcast interval validation
  if (config.shutdown_broadcast_interval_seconds < 10) {
    errors.shutdown_broadcast_interval_seconds = 'Broadcast interval must be at least 10 seconds';
  } else if (config.shutdown_broadcast_interval_seconds > 600) {
    errors.shutdown_broadcast_interval_seconds = 'Broadcast interval should not exceed 10 minutes';
  }

  // Device offline threshold validation
  if (config.device_offline_threshold_seconds < 30) {
    errors.device_offline_threshold_seconds = 'Offline threshold must be at least 30 seconds';
  } else if (config.device_offline_threshold_seconds > 600) {
    errors.device_offline_threshold_seconds = 'Offline threshold should not exceed 10 minutes';
  }

  return errors;
}
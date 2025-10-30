export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ApiError {
  detail: string;
  status?: number;
}

export interface Bunker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  orientation: number;
  fan_count: number;
  wind_threshold: number; // mph
  electricity_cost_kwh?: number;
  fan_power_watts?: number;
  is_active: boolean;
  status?: 'online' | 'offline' | 'energy_saving';
  emergency_on?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeatherData {
  id: string;
  wind_speed: number; // mph
  wind_direction: number;
  temperature?: number; // Fahrenheit
  humidity?: number;
  measured_at: string;
}

export interface DeviceProvisioningRequest {
  bunker_id: string;
  mac_address: string;
  fan_position: number;
}

export interface DeviceProvisioningResponse {
  device_id: string;
  auth_token: string;
  led_flash_sequence: number;
  bunker_name: string;
  fan_position: number;
}

export interface Device {
  id: string;
  bunker_id: string;
  fan_position: number;
  mac_address: string;
  auth_token?: string;
  firmware_version: string;
  last_seen: string | null;
  provisioned_at: string;
  led_flash_sequence: number;
  is_online: boolean;
}

export interface DeviceWithBunkerInfo extends Device {
  bunker_name: string;
}

export interface DeviceStatus {
  device_id: string;
  fan_position: number;
  mac_address?: string;
  name?: string;
  relay_state: 'ON' | 'OFF';
  is_online: boolean;
  wifi_rssi?: number;
  uptime_seconds?: number;
  countdown_timer_remaining?: number;
  last_seen: string;
}

export interface EmergencyOnRequest {
  bunker_id?: string;
}

export interface EmergencyOnResponse {
  success: boolean;
  message: string;
  bunker_id?: string;
  affected_bunkers?: number;
  affected_devices: number;
}

export interface GlobalConfig {
  id: number;
  emergency_on_global?: boolean;
  default_wind_threshold_mph: number;
  default_electricity_cost_kwh: number;
  default_fan_power_watts: number;
  weather_station_id: string;
  weather_poll_interval_seconds: number;
  weather_staleness_minutes: number;
  shutdown_broadcast_interval_seconds: number;
  device_offline_threshold_seconds: number;
  created_at?: string;
  updated_at?: string;
}

export interface GlobalConfigUpdateRequest {
  default_wind_threshold_mph: number;
  default_electricity_cost_kwh: number;
  default_fan_power_watts: number;
  weather_station_id: string;
  weather_poll_interval_seconds?: number;
  weather_staleness_minutes?: number;
  shutdown_broadcast_interval_seconds?: number;
  device_offline_threshold_seconds?: number;
}

export type HealthSeverity = 'info' | 'warning' | 'critical';
export type ServiceState = 'online' | 'degraded' | 'offline';
export type OverallStatus = 'green' | 'yellow' | 'red';

export interface HealthAlert {
  id: string;
  type: string;
  message: string;
  severity: HealthSeverity;
  timestamp: string;
}

export interface WeatherConditions {
  wind_speed_mph?: number | null;
  wind_direction_degrees?: number | null;
  temperature_f?: number | null;
  observation_time?: string | null;
}

export interface WeatherServiceStatus {
  status: ServiceState;
  station_id: string;
  last_successful_fetch?: string | null;
  stale: boolean;
  message?: string | null;
  conditions?: WeatherConditions | null;
}

export interface DatabaseStatus {
  status: ServiceState;
  latency_ms?: number | null;
  message?: string | null;
}

export interface SystemHealthSummary {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  system_uptime_seconds: number;
  backend_uptime_seconds: number;
  weather_service: WeatherServiceStatus;
  database: DatabaseStatus;
  alerts: HealthAlert[];
  overall_status: OverallStatus;
  last_updated: string;
  total_energy_saved_kwh: number;
  total_energy_cost_saved_usd?: number | null;
}

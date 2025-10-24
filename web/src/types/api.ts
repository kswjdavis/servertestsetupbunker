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
  wind_threshold: number;
  is_active: boolean;
  status?: 'online' | 'offline' | 'energy_saving';
  emergency_on_bunker?: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeatherData {
  id: string;
  wind_speed: number;
  wind_direction: number;
  temperature?: number;
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
  firmware_version: string;
  last_seen: string | null;
  provisioned_at: string;
  led_flash_sequence: number;
  is_online: boolean;
}

export interface DeviceWithBunkerInfo extends Device {
  bunker_name: string;
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
  shutdown_broadcast_interval_seconds?: number;
  device_offline_threshold_seconds?: number;
}
// Convert DMS to decimal degrees
// Deerfield: 37°58'40.33"N 101° 8'16.19"W
// PlumCreek Syracuse: 37°58'50.25"N 101°45'15.35"W

export const mockBunkers = [
  {
    id: '1',
    name: 'Deerfield',
    latitude: 37.977869, // 37°58'40.33"N
    longitude: -101.137831, // 101° 8'16.19"W
    orientation: 45,  // Facing NE
    fan_count: 6,
    wind_threshold: 12,  // mph
    is_active: true,
    status: 'online' as const,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-10-24T15:00:00Z'
  },
  {
    id: '2',
    name: 'PlumCreek Syracuse',
    latitude: 37.980625, // 37°58'50.25"N
    longitude: -101.754306, // 101°45'15.35"W
    orientation: 270,  // Facing West
    fan_count: 8,
    wind_threshold: 15,  // mph
    is_active: true,
    status: 'energy_saving' as const,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-10-24T15:00:00Z'
  }
];

export const mockWeatherData = {
  id: '1',
  wind_speed: 16.8,  // mph (was 7.5 m/s)
  wind_direction: 225,
  temperature: 72.5,  // Fahrenheit (was 22.5°C)
  humidity: 65,
  measured_at: new Date().toISOString()
};

export const mockGlobalConfig = {
  id: 1,
  default_wind_threshold_mph: 20, // mph
  default_electricity_cost_kwh: 0.12, // $/kWh
  default_fan_power_watts: 1500,
  weather_station_id: 'KGCK',
  weather_poll_interval_seconds: 60,
  weather_staleness_minutes: 3,
  shutdown_broadcast_interval_seconds: 60,
  device_offline_threshold_seconds: 120,
  emergency_on_global: false,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-10-24T15:00:00Z'
};

export const mockTimeWindowOverrides = [
  {
    id: '1',
    bunker_id: '1',
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    end_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4 hours from now
    reason: 'Harvest operations - keep fans running',
    is_global: false,
    created_by: 'admin@farm.com',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '2',
    bunker_id: null,
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    end_time: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(), // Tomorrow + 4 hours
    reason: 'System maintenance - all fans must run',
    is_global: true,
    created_by: 'admin@farm.com',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: '3',
    bunker_id: '1',
    start_time: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
    end_time: new Date(Date.now() - 40 * 60 * 60 * 1000).toISOString(), // 40 hours ago
    reason: 'Emergency drying period',
    is_global: false,
    created_by: 'operator@farm.com',
    created_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString()
  }
];

export const mockWeatherStations = [
  {
    id: 'KGCK',
    name: 'Garden City Regional Airport',
    latitude: 37.9275,
    longitude: -100.7244,
    wind_speed: 16.8,  // mph
    wind_direction: 225,
    temperature: 72.5,  // Fahrenheit
    humidity: 65,
    barometer: 29.92,  // inHg
    measured_at: new Date().toISOString()
  },
  {
    id: 'KDDC',
    name: 'Dodge City Regional Airport',
    latitude: 37.7628,
    longitude: -99.9656,
    wind_speed: 14.2,  // mph
    wind_direction: 240,
    temperature: 74.0,  // Fahrenheit
    humidity: 58,
    barometer: 29.88,  // inHg
    measured_at: new Date().toISOString()
  }
];

export const mockBunkerStatus = {
  '1': { // Deerfield bunker
    bunker: mockBunkers[0],
    devices: [
      {
        device_id: 'dev-1',
        fan_position: 1,
        mac_address: 'AA:BB:CC:DD:EE:01',
        relay_state: 'ON' as const,
        is_online: true,
        wifi_rssi: -65,
        uptime_seconds: 86400,
        countdown_timer_remaining: 0,
        last_seen: new Date().toISOString()
      },
      {
        device_id: 'dev-2',
        fan_position: 2,
        mac_address: 'AA:BB:CC:DD:EE:02',
        relay_state: 'ON' as const,
        is_online: true,
        wifi_rssi: -70,
        uptime_seconds: 86400,
        countdown_timer_remaining: 0,
        last_seen: new Date().toISOString()
      },
      {
        device_id: 'dev-3',
        fan_position: 3,
        mac_address: 'AA:BB:CC:DD:EE:03',
        relay_state: 'OFF' as const,
        is_online: true,
        wifi_rssi: -68,
        uptime_seconds: 43200,
        countdown_timer_remaining: 0,
        last_seen: new Date().toISOString()
      },
      {
        device_id: 'dev-4',
        fan_position: 4,
        mac_address: 'AA:BB:CC:DD:EE:04',
        relay_state: 'OFF' as const,
        is_online: false,
        wifi_rssi: 0,
        uptime_seconds: 0,
        countdown_timer_remaining: 0,
        last_seen: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
      },
      {
        device_id: 'dev-5',
        fan_position: 5,
        mac_address: 'AA:BB:CC:DD:EE:05',
        relay_state: 'ON' as const,
        is_online: true,
        wifi_rssi: -72,
        uptime_seconds: 3600,
        countdown_timer_remaining: 0,
        last_seen: new Date().toISOString()
      },
      {
        device_id: 'dev-6',
        fan_position: 6,
        mac_address: 'AA:BB:CC:DD:EE:06',
        relay_state: 'ON' as const,
        is_online: true,
        wifi_rssi: -60,
        uptime_seconds: 7200,
        countdown_timer_remaining: 0,
        last_seen: new Date().toISOString()
      }
    ],
    weather: mockWeatherData
  },
  '2': { // PlumCreek Syracuse bunker
    bunker: mockBunkers[1],
    devices: Array.from({ length: 8 }, (_, i) => ({
      device_id: `dev-pc-${i + 1}`,
      fan_position: i + 1,
      mac_address: `BB:CC:DD:EE:FF:0${i + 1}`,
      relay_state: i % 3 === 0 ? 'OFF' as const : 'ON' as const,
      is_online: i !== 3, // Fan 4 is offline
      wifi_rssi: i === 3 ? 0 : -60 - i * 2,
      uptime_seconds: 86400 - i * 3600,
      countdown_timer_remaining: 0,
      last_seen: i === 3
        ? new Date(Date.now() - 180000).toISOString()
        : new Date().toISOString()
    })),
    weather: mockWeatherData
  }
};

export const mockDevices = [
  {
    id: 'dev-1',
    bunker_id: '1',
    bunker_name: 'Deerfield',
    fan_position: 1,
    mac_address: 'AA:BB:CC:DD:EE:01',
    auth_token: 'AUTH-DEV-0001-ABC1',
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    provisioned_at: '2024-10-20T10:00:00Z',
    led_flash_sequence: 3,
    is_online: true
  },
  {
    id: 'dev-2',
    bunker_id: '1',
    bunker_name: 'Deerfield',
    fan_position: 2,
    mac_address: 'AA:BB:CC:DD:EE:02',
    auth_token: 'AUTH-DEV-0002-ABC2',
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    provisioned_at: '2024-10-20T10:05:00Z',
    led_flash_sequence: 4,
    is_online: true
  },
  {
    id: 'dev-3',
    bunker_id: '1',
    bunker_name: 'Deerfield',
    fan_position: 3,
    mac_address: 'AA:BB:CC:DD:EE:03',
    auth_token: 'AUTH-DEV-0003-ABC3',
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 45000).toISOString(), // 45 seconds ago
    provisioned_at: '2024-10-21T14:00:00Z',
    led_flash_sequence: 5,
    is_online: true
  },
  {
    id: 'dev-4',
    bunker_id: '2',
    bunker_name: 'PlumCreek Syracuse',
    fan_position: 1,
    mac_address: 'AA:BB:CC:DD:EE:04',
    auth_token: 'AUTH-DEV-0004-ABC4',
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 150000).toISOString(), // 2.5 minutes ago - offline
    provisioned_at: '2024-10-21T14:10:00Z',
    led_flash_sequence: 6,
    is_online: false
  },
  {
    id: 'dev-5',
    bunker_id: '2',
    bunker_name: 'PlumCreek Syracuse',
    fan_position: 2,
    mac_address: 'AA:BB:CC:DD:EE:05',
    auth_token: 'AUTH-DEV-0005-ABC5',
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 20000).toISOString(), // 20 seconds ago
    provisioned_at: '2024-10-22T09:00:00Z',
    led_flash_sequence: 2,
    is_online: true
  },
  {
    id: 'dev-6',
    bunker_id: '2',
    bunker_name: 'PlumCreek Syracuse',
    fan_position: 3,
    mac_address: 'AA:BB:CC:DD:EE:06',
    auth_token: 'AUTH-DEV-0006-ABC6',
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 90000).toISOString(), // 1.5 minutes ago
    provisioned_at: '2024-10-22T09:10:00Z',
    led_flash_sequence: 7,
    is_online: true
  }
];

export const mockEnergySavings = {
  '1': { // Deerfield bunker
    bunker_id: '1',
    bunker_name: 'Deerfield',
    total_kwh_saved: 1234.5,
    total_cost_saved: 148.14,  // $0.12 per kWh
    total_off_time_seconds: 8883000,  // ~102 days, 19 hours
    calculation_period: {
      start: '2024-01-15T10:00:00Z',
      end: new Date().toISOString()
    },
    trend: {
      percentage_change: 12.5,
      direction: 'up' as const
    }
  },
  '2': { // PlumCreek Syracuse bunker
    bunker_id: '2',
    bunker_name: 'PlumCreek Syracuse',
    total_kwh_saved: 2156.8,
    total_cost_saved: 258.82,  // $0.12 per kWh
    total_off_time_seconds: 15528960,  // ~179 days, 17 hours
    calculation_period: {
      start: '2024-01-15T10:00:00Z',
      end: new Date().toISOString()
    },
    trend: {
      percentage_change: 8.2,
      direction: 'up' as const
    }
  }
};

export const mockSystemWideSavings = {
  total_kwh_saved: 3391.3,  // Sum of both bunkers
  total_cost_saved: 406.96,  // Sum of both bunkers
  total_off_time_seconds: 24411960,  // Combined off time
  bunker_count: 2,
  device_count: 14,  // 6 + 8 fans
  by_bunker: Object.values(mockEnergySavings),
  trend: {
    percentage_change: 10.3,
    direction: 'up' as const
  }
};

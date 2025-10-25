// Convert DMS to decimal degrees
// Deerfield: 37°58'40.33"N 101° 8'16.19"W
// PlumCreek Syracuse: 37°58'50.25"N 101°45'15.35"W

export const mockBunkers = [
  {
    id: '1',
    name: 'Deerfield',
    latitude: 37.977869, // 37°58'40.33"N
    longitude: -101.137831, // 101° 8'16.19"W
    orientation: 0,
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
    orientation: 0,
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

export const mockDevices = [
  {
    id: 'dev-1',
    bunker_id: '1',
    bunker_name: 'Deerfield',
    fan_position: 1,
    mac_address: 'AA:BB:CC:DD:EE:01',
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
    firmware_version: '1.0.0',
    last_seen: new Date(Date.now() - 90000).toISOString(), // 1.5 minutes ago
    provisioned_at: '2024-10-22T09:10:00Z',
    led_flash_sequence: 7,
    is_online: true
  }
];
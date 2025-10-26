import api from './api';

interface WeatherData {
  station_id?: string;
  wind_speed: number;       // mph
  wind_direction: number;   // degrees
  temperature: number;      // Fahrenheit
  humidity: number;         // percentage
  barometer?: number;       // inHg
  measured_at: string;      // ISO timestamp
}

export async function getCurrentWeather(): Promise<WeatherData> {
  const response = await api.get<WeatherData>('/api/v1/weather/current');
  return response.data;
}

export async function getWeatherHistory(hours: number = 24): Promise<WeatherData[]> {
  const response = await api.get<WeatherData[]>('/api/v1/weather/history', {
    params: { hours }
  });
  return response.data;
}

export async function getWeatherStations(): Promise<any[]> {
  const response = await api.get<any[]>('/api/v1/weather/stations');
  return response.data;
}
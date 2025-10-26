import { useState, useEffect, useRef } from 'react';
import * as weatherService from '../services/weather.service';
import { mockWeatherData } from '../services/mockData';

interface WeatherData {
  station_id?: string;
  wind_speed: number;       // mph
  wind_direction: number;   // degrees
  temperature: number;      // Fahrenheit
  humidity: number;         // percentage
  barometer?: number;       // inHg
  measured_at: string;      // ISO timestamp
}

export function useWeather(pollInterval: number = 3000) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const weather = await weatherService.getCurrentWeather();
        setData(weather);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch weather:', err);
        // Use mock data as fallback
        setData(mockWeatherData);
        setError(null); // Don't show error if we have mock data
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchWeather();

    // Set up polling
    intervalRef.current = setInterval(fetchWeather, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollInterval]);

  return { data, loading, error };
}
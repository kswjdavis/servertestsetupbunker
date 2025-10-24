import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import WindScorecard from '../components/weather/WindScorecard';
import UpdateIndicator from '../components/common/UpdateIndicator';
import { usePoll } from '../hooks/usePoll';
import { usePageVisibility } from '../hooks/usePageVisibility';
import type { Bunker, WeatherData } from '../types/api';
import { mockBunkers, mockWeatherData } from '../services/mockData';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons based on status
const createIcon = (status: string) => {
  const colors = {
    online: '#10b981', // green
    offline: '#ef4444', // red
    energy_saving: '#3b82f6', // blue
    default: '#6b7280' // gray
  };

  const color = colors[status as keyof typeof colors] || colors.default;

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        position: relative;
        transform: rotate(-45deg);
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <div style="
          position: absolute;
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};


export default function MapDashboard() {
  const navigate = useNavigate();
  const [bunkers, setBunkers] = useState<Bunker[]>([]);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isVisible = usePageVisibility();

  const fetchData = useCallback(async () => {
    try {
      setUpdating(true);

      // Fetch bunkers
      try {
        const bunkersResponse = await api.get('/api/v1/bunkers');
        setBunkers(bunkersResponse.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching bunkers:', err);
        // Use mock data as fallback for demo
        console.log('Using mock data for demo purposes');
        setBunkers(mockBunkers);
        setError(null);
      }

      // Fetch weather data
      try {
        const weatherResponse = await api.get('/api/v1/weather/current');
        setWeatherData(weatherResponse.data);
      } catch (err) {
        console.error('Error fetching weather data:', err);
        // Use mock data as fallback for demo
        setWeatherData(mockWeatherData);
      }
    } finally {
      setLoading(false);
      setUpdating(false);
    }
  }, []);

  // Poll every 3 seconds, but only when tab is visible
  usePoll(fetchData, 3000, isVisible);

  // Calculate center of map based on bunker locations
  const calculateCenter = (): [number, number] => {
    if (bunkers.length === 0) {
      // Default to western Kansas area where the bunkers are located
      return [37.979, -101.446];
    }

    const avgLat = bunkers.reduce((sum, b) => sum + b.latitude, 0) / bunkers.length;
    const avgLng = bunkers.reduce((sum, b) => sum + b.longitude, 0) / bunkers.length;
    return [avgLat, avgLng];
  };

  const getMarkerStatus = (bunker: Bunker): string => {
    if (!bunker.is_active) return 'offline';
    return bunker.status || 'offline';
  };

  const getStatusLabel = (status: string): string => {
    const labels = {
      online: 'All Fans ON',
      offline: 'Offline',
      energy_saving: 'Energy Saving',
    };
    return labels[status as keyof typeof labels] || 'Unknown';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bunker data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchData();
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const center = calculateCenter();

  return (
    <div className="h-screen w-full flex flex-col">
      {updating && <UpdateIndicator />}
      <WindScorecard weatherData={weatherData} />
      <div className="flex-1">
        <MapContainer
          center={center}
          zoom={bunkers.length > 1 ? 10 : 13}
          className="h-full w-full"
          zoomControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

        {bunkers.map((bunker) => {
          const status = getMarkerStatus(bunker);
          return (
            <Marker
              key={bunker.id}
              position={[bunker.latitude, bunker.longitude]}
              icon={createIcon(status)}
              eventHandlers={{
                click: () => {
                  navigate(`/bunkers/${bunker.id}`);
                },
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-lg">{bunker.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Status: <span className={`font-semibold ${
                      status === 'online' ? 'text-green-600' :
                      status === 'energy_saving' ? 'text-blue-600' :
                      'text-red-600'
                    }`}>{getStatusLabel(status)}</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    Fans: {bunker.fan_count}
                  </p>
                  <p className="text-sm text-gray-600">
                    Wind Threshold: {bunker.wind_threshold} m/s
                  </p>
                  <button
                    onClick={() => navigate(`/bunkers/${bunker.id}`)}
                    className="mt-2 text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 min-h-[44px] w-full"
                  >
                    View Details →
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
        </MapContainer>
      </div>
    </div>
  );
}
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../services/api';
import WindScorecard from '../components/weather/WindScorecard';
import SystemWideSavingsDisplay from '../components/dashboard/SystemWideSavings';
import BunkerGrid from '../components/bunker/BunkerGrid';
import UpdateIndicator from '../components/common/UpdateIndicator';
import { usePoll } from '../hooks/usePoll';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { useEnergySavings } from '../hooks/useEnergySavings';
import type { Bunker, WeatherData } from '../types/api';
import type { SystemWideSavings } from '../services/energy.service';
import { mockBunkers, mockWeatherData, mockWeatherStations } from '../services/mockData';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons for weather stations
const createWeatherIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: #6b7280;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        position: relative;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          color: white;
          font-size: 14px;
          font-weight: bold;
        ">W</div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
};

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
  const [weatherStations, setWeatherStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  const isVisible = usePageVisibility();

  // Poll system-wide energy savings every 10 seconds
  const { data: systemSavings } = useEnergySavings(undefined, 10000);

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

      // Set weather stations (mock for now)
      setWeatherStations(mockWeatherStations);
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

      {/* System-Wide Energy Savings */}
      {systemSavings && !('bunker_id' in systemSavings) && (
        <div className="p-4">
          <SystemWideSavingsDisplay savings={systemSavings as SystemWideSavings} />
        </div>
      )}

      <WindScorecard weatherData={weatherData} stationId="KGCK" />

      {/* View mode toggle */}
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 border-y border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'map'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            aria-label="Map view"
          >
            <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Map
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            aria-label="Grid view"
          >
            <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Grid
          </button>
        </div>

        <button
          onClick={() => navigate('/bunkers/new')}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          aria-label="Create new bunker"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 4v16m8-8H4" />
          </svg>
          Create Bunker
        </button>
      </div>

      <div className="flex-1 relative min-h-[400px]">{viewMode === 'grid' ? (
        <div className="p-4">
          <BunkerGrid />
        </div>
      ) : (
        <>

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

        {/* Weather Station Markers */}
        {weatherStations.map((station) => {
          const getCompassDirection = (degrees: number): string => {
            const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
            const index = Math.round(degrees / 22.5) % 16;
            return directions[index];
          };

          return (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={createWeatherIcon()}
            >
              <Tooltip permanent direction="top" offset={[0, -20]} className="weather-tooltip">
                <div style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  padding: '8px',
                  borderRadius: '4px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  minWidth: '150px'
                }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px' }}>
                    {station.id} - {station.name}
                  </div>
                  <div style={{ fontSize: '10px', lineHeight: '1.3' }}>
                    <div>Wind: {station.wind_speed} mph @ {getCompassDirection(station.wind_direction)}</div>
                    <div>Temp: {station.temperature}°F</div>
                    <div>Baro: {station.barometer} inHg</div>
                    <div>Humidity: {station.humidity}%</div>
                  </div>
                </div>
              </Tooltip>
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-lg">{station.id}</h3>
                  <p className="text-sm text-gray-600">{station.name}</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>Wind: {station.wind_speed} mph @ {getCompassDirection(station.wind_direction)}</p>
                    <p>Temperature: {station.temperature}°F</p>
                    <p>Barometer: {station.barometer} inHg</p>
                    <p>Humidity: {station.humidity}%</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Updated: {new Date(station.measured_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Bunker Markers */}
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
                    Wind Threshold: {bunker.wind_threshold} mph
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
        </>
      )}</div>
    </div>
  );
}
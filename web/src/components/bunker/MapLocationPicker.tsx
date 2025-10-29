import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapLocationPickerProps {
  latitude?: number;
  longitude?: number;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function LocationMarker({ position, onLocationChange }: {
  position: [number, number];
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const [markerPosition, setMarkerPosition] = useState(position);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setMarkerPosition([lat, lng]);
      onLocationChange(lat, lng);
    }
  });

  return <Marker position={markerPosition} />;
}

export default function MapLocationPicker({
  latitude = 37.979,
  longitude = -101.446,
  onLocationChange,
  className = ''
}: MapLocationPickerProps) {
  const position: [number, number] = [latitude, longitude];

  return (
    <div className={`${className}`}>
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bunker Location
        </label>
        <p className="text-xs text-gray-500">Click on the map to set bunker location</p>
      </div>

      <div className="border border-gray-300 rounded-lg overflow-hidden" style={{ height: '300px' }}>
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <LocationMarker position={position} onLocationChange={onLocationChange} />
        </MapContainer>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="latitude" className="block text-xs font-medium text-gray-700 mb-1">
            Latitude
          </label>
          <input
            type="number"
            id="latitude"
            step="0.000001"
            min="-90"
            max="90"
            value={latitude}
            onChange={(e) => {
              const lat = parseFloat(e.target.value);
              if (!isNaN(lat) && lat >= -90 && lat <= 90) {
                onLocationChange(lat, longitude);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            placeholder="e.g., 41.8781"
          />
        </div>
        <div>
          <label htmlFor="longitude" className="block text-xs font-medium text-gray-700 mb-1">
            Longitude
          </label>
          <input
            type="number"
            id="longitude"
            step="0.000001"
            min="-180"
            max="180"
            value={longitude}
            onChange={(e) => {
              const lng = parseFloat(e.target.value);
              if (!isNaN(lng) && lng >= -180 && lng <= 180) {
                onLocationChange(latitude, lng);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm font-mono"
            placeholder="e.g., -87.6298"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Click on the map or enter coordinates manually
      </p>
    </div>
  );
}
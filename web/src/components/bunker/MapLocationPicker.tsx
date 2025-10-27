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

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-50 p-2 rounded">
          <span className="text-gray-600">Lat:</span>
          <span className="ml-1 font-mono">{latitude.toFixed(6)}</span>
        </div>
        <div className="bg-gray-50 p-2 rounded">
          <span className="text-gray-600">Lng:</span>
          <span className="ml-1 font-mono">{longitude.toFixed(6)}</span>
        </div>
      </div>
    </div>
  );
}
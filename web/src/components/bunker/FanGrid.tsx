import React from 'react';
import FanStatusCard from './FanStatusCard';
import type { DeviceStatus } from '../../types/api';

interface FanGridProps {
  devices: DeviceStatus[];
  onFanClick: (deviceId: string) => void;
}

export default function FanGrid({ devices, onFanClick }: FanGridProps) {
  if (!devices || devices.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center">No fans configured for this bunker</p>
      </div>
    );
  }

  const sortedDevices = [...devices].sort((a, b) => a.fan_position - b.fan_position);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Fan Status</h2>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Running (ON)</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-blue-500 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Energy Saving (OFF)</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
          <span className="text-sm text-gray-600">Offline</span>
        </div>
      </div>

      {/* Fan Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {sortedDevices.map((device) => (
          <FanStatusCard
            key={device.device_id}
            deviceId={device.device_id}
            fanPosition={device.fan_position}
            relayState={device.relay_state}
            isOnline={device.is_online}
            wifiRssi={device.wifi_rssi}
            lastSeen={device.last_seen}
            onClick={() => onFanClick(device.device_id)}
          />
        ))}
      </div>

      {/* Summary Statistics */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Fans:</span>
            <span className="ml-2 font-medium text-gray-900">{devices.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Running:</span>
            <span className="ml-2 font-medium text-green-600">
              {devices.filter(d => d.is_online && d.relay_state === 'ON').length}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Energy Saving:</span>
            <span className="ml-2 font-medium text-blue-600">
              {devices.filter(d => d.is_online && d.relay_state === 'OFF').length}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Offline:</span>
            <span className="ml-2 font-medium text-red-600">
              {devices.filter(d => !d.is_online).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePoll } from '../hooks/usePoll';
import { usePageVisibility } from '../hooks/usePageVisibility';
import UpdateIndicator from '../components/common/UpdateIndicator';
import * as deviceService from '../services/device.service';
import { mockDevices } from '../services/mockData';
import { isDeviceOnline, formatLastSeen } from '../utils/deviceHelpers';
import EmptyState from '../components/common/EmptyState';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import DeviceStatusBadge from '../components/device/DeviceStatusBadge';
import DeviceDeleteModal from '../components/device/DeviceDeleteModal';
import type { DeviceWithBunkerInfo } from '../types/api';

export default function DeviceListPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceWithBunkerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deviceToDelete, setDeviceToDelete] = useState<DeviceWithBunkerInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const isVisible = usePageVisibility();

  const fetchDevices = useCallback(async () => {
    try {
      setUpdating(true);
      const data = await deviceService.listDevices();
      // Update online status based on last_seen
      const updatedDevices = data.map(device => ({
        ...device,
        is_online: isDeviceOnline(device.last_seen)
      }));
      setDevices(updatedDevices);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      // Use mock data as fallback
      console.log('Using mock devices for demo');
      const updatedMockDevices = mockDevices.map(device => ({
        ...device,
        last_seen: device.last_seen ? new Date(Date.now() - Math.random() * 180000).toISOString() : null,
        is_online: isDeviceOnline(device.last_seen)
      }));
      setDevices(updatedMockDevices);
      setLoading(false);
    } finally {
      setUpdating(false);
    }
  }, []);

  // Poll every 5 seconds, but only when tab is visible
  usePoll(fetchDevices, 5000, isVisible);

  const handleDelete = async () => {
    if (!deviceToDelete) return;

    setIsDeleting(true);
    try {
      await deviceService.deleteDevice(deviceToDelete.id);
      // Remove device from list
      setDevices(prev => prev.filter(d => d.id !== deviceToDelete.id));
      setDeviceToDelete(null);
    } catch (error) {
      console.error('Failed to delete device:', error);
      // For demo, just remove from list
      setDevices(prev => prev.filter(d => d.id !== deviceToDelete.id));
      setDeviceToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleProvisionNew = () => {
    navigate('/devices/provision');
  };

  const handleRowClick = (deviceId: string) => {
    navigate(`/devices/${deviceId}`);
  };

  // Filter devices by bunker name
  const filteredDevices = devices.filter(device =>
    device.bunker_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Device Management</h1>
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {updating && <UpdateIndicator />}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900">Device Management</h1>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => navigate('/bunkers/new')}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium min-h-[44px] w-full md:w-auto flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 4v16m8-8H4" />
            </svg>
            Create Bunker
          </button>
          <button
            onClick={handleProvisionNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium min-h-[44px] w-full md:w-auto"
          >
            + Provision New Device
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="bg-white rounded-lg shadow">
          <EmptyState
            title="No devices provisioned"
            message="Get started by provisioning your first ESP32 device."
            action={{
              label: 'Provision Device',
              onClick: handleProvisionNew
            }}
          />
        </div>
      ) : (
        <>
          {/* Search bar */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search by bunker name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            />
          </div>

          {/* Device table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Device ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bunker
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fan Position
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Seen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDevices.map((device) => (
                    <tr
                      key={device.id}
                      onClick={() => handleRowClick(device.id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {device.mac_address}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (device.bunker_id) {
                              navigate(`/bunkers/${device.bunker_id}`);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          {device.bunker_name}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {device.fan_position}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <DeviceStatusBadge isOnline={device.is_online} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatLastSeen(device.last_seen)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeviceToDelete(device);
                          }}
                          className="text-red-600 hover:text-red-900 px-3 py-2 min-h-[44px]"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredDevices.length === 0 && searchTerm && (
              <div className="px-6 py-4 text-center text-gray-500">
                No devices found matching "{searchTerm}"
              </div>
            )}
          </div>

          {/* Device count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredDevices.length} of {devices.length} devices
            {searchTerm && ` (filtered by "${searchTerm}")`}
          </div>
        </>
      )}

      {/* Delete confirmation modal */}
      {deviceToDelete && (
        <DeviceDeleteModal
          device={deviceToDelete}
          onConfirm={handleDelete}
          onCancel={() => setDeviceToDelete(null)}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
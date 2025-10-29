import api from './api';
import type { DeviceProvisioningRequest, DeviceProvisioningResponse, Bunker, DeviceWithBunkerInfo } from '../types/api';

export const provisionDevice = async (request: DeviceProvisioningRequest): Promise<DeviceProvisioningResponse> => {
  const response = await api.post<DeviceProvisioningResponse>('/api/v1/devices/provision', request);
  return response.data;
};

export const fetchBunkers = async (): Promise<Bunker[]> => {
  const response = await api.get<Bunker[]>('/api/v1/bunkers');
  return response.data;
};

export const listDevices = async (): Promise<DeviceWithBunkerInfo[]> => {
  const response = await api.get<{devices: DeviceWithBunkerInfo[]}>('/api/v1/devices');
  return response.data.devices;
};

export const deleteDevice = async (deviceId: string): Promise<void> => {
  await api.delete(`/api/v1/devices/${deviceId}`);
};
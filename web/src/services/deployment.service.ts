import api from './api';
import type { Bunker, Device } from '../types/api';
import { mockBunkers, mockDevices } from './mockData';

export interface DeploymentData {
  bunkers: Bunker[];
  devicesByBunker: Record<string, Device[]>;
}

export const fetchDeploymentBunkers = async (bunkerId?: string): Promise<Bunker[]> => {
  try {
    if (bunkerId) {
      const response = await api.get<Bunker>(`/api/v1/bunkers/${bunkerId}`);
      return [response.data];
    }

    const response = await api.get<Bunker[]>('/api/v1/bunkers');
    return response.data;
  } catch (error) {
    if (bunkerId) {
      return mockBunkers.filter((bunker) => bunker.id === bunkerId);
    }

    return mockBunkers;
  }
};

export const fetchDevicesForBunker = async (bunkerId: string): Promise<Device[]> => {
  try {
    const response = await api.get<Device[]>(`/api/v1/bunkers/${bunkerId}/devices`);
    return response.data;
  } catch (error) {
    return mockDevices.filter((device) => device.bunker_id === bunkerId);
  }
};

export const fetchDeploymentData = async (bunkerId?: string): Promise<DeploymentData> => {
  const bunkers = await fetchDeploymentBunkers(bunkerId);

  const devicesEntries = await Promise.all(
    bunkers.map(async (bunker) => {
      const devices = await fetchDevicesForBunker(bunker.id);
      return [bunker.id, devices] as const;
    })
  );

  return {
    bunkers,
    devicesByBunker: Object.fromEntries(devicesEntries),
  };
};

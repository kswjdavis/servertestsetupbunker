import api from './api';
import type { EmergencyOnRequest, EmergencyOnResponse } from '../types/api';

export async function emergencyOnAll(): Promise<EmergencyOnResponse> {
  const response = await api.post<EmergencyOnResponse>('/api/v1/control/emergency-on-all');
  return response.data;
}

export async function emergencyOnBunker(bunkerId: string): Promise<EmergencyOnResponse> {
  const response = await api.post<EmergencyOnResponse>('/api/v1/control/emergency-on', {
    bunker_id: bunkerId
  });
  return response.data;
}

export async function clearEmergencyAll(): Promise<void> {
  await api.delete('/api/v1/control/emergency-on-all');
}

export async function clearEmergencyBunker(bunkerId: string): Promise<void> {
  await api.delete(`/api/v1/control/emergency-on/${bunkerId}`);
}
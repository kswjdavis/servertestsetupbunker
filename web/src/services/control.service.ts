import api from './api';
import type { EmergencyOnRequest, EmergencyOnResponse } from '../types/api';

export async function emergencyOnAll(): Promise<EmergencyOnResponse> {
  // TODO: Implement global emergency mode via global_config endpoint
  throw new Error('Global emergency mode not yet implemented');
}

export async function emergencyOnBunker(bunkerId: string): Promise<EmergencyOnResponse> {
  const response = await api.put(`/api/v1/bunkers/${bunkerId}`, {
    emergency_on: true
  });
  return {
    success: true,
    message: 'Emergency mode activated',
    bunker_id: bunkerId,
    affected_devices: response.data.device_count || 0
  };
}

export async function clearEmergencyAll(): Promise<void> {
  // TODO: Implement global emergency mode via global_config endpoint
  throw new Error('Global emergency mode not yet implemented');
}

export async function clearEmergencyBunker(bunkerId: string): Promise<void> {
  await api.put(`/api/v1/bunkers/${bunkerId}`, {
    emergency_on: false
  });
}
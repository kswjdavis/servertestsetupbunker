import api from './api';
import type { Bunker } from '../types/api';

export interface BunkerCreateRequest {
  name: string;
  latitude: number;
  longitude: number;
  orientation: number;
  fan_count: number;
  wind_threshold: number;
  electricity_cost_kwh?: number;
  fan_power_watts?: number;
}

export interface BunkerUpdateRequest extends BunkerCreateRequest {
  is_active?: boolean;
}

export async function listBunkers(): Promise<Bunker[]> {
  const response = await api.get<Bunker[]>('/api/v1/bunkers');
  return response.data;
}

export async function getBunker(id: string): Promise<Bunker> {
  const response = await api.get<Bunker>(`/api/v1/bunkers/${id}`);
  return response.data;
}

export async function getBunkerStatus(id: string): Promise<any> {
  const response = await api.get(`/api/v1/bunkers/${id}/status`);
  return response.data;
}

export async function createBunker(data: BunkerCreateRequest): Promise<Bunker> {
  const response = await api.post<Bunker>('/api/v1/bunkers', data);
  return response.data;
}

export async function updateBunker(id: string, data: BunkerUpdateRequest): Promise<Bunker> {
  const response = await api.put<Bunker>(`/api/v1/bunkers/${id}`, data);
  return response.data;
}

export async function deleteBunker(id: string): Promise<void> {
  await api.delete(`/api/v1/bunkers/${id}`);
}
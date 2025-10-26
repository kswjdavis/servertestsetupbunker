import api from './api';
import type { GlobalConfig } from '../types/api';

export async function getGlobalConfig(): Promise<GlobalConfig> {
  const response = await api.get<GlobalConfig>('/api/v1/config');
  return response.data;
}

export async function updateGlobalConfig(config: Partial<GlobalConfig>): Promise<GlobalConfig> {
  const response = await api.put<GlobalConfig>('/api/v1/config', config);
  return response.data;
}
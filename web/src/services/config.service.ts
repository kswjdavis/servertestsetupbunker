import api from './api';
import type { GlobalConfig, GlobalConfigUpdateRequest } from '../types/api';

export async function getConfig(): Promise<GlobalConfig> {
  const response = await api.get<GlobalConfig>('/api/v1/config');
  return response.data;
}

export async function updateConfig(config: GlobalConfigUpdateRequest): Promise<GlobalConfig> {
  const response = await api.put<GlobalConfig>('/api/v1/config', config);
  return response.data;
}
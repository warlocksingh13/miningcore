import axios from 'axios';
import { API_CONFIG } from './config';

export const apiClient = axios.create({
  baseURL: API_CONFIG.baseUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

export const fetchPools = async () => {
  try {
    console.log(`Fetching from: ${API_CONFIG.baseUrl}${API_CONFIG.endpoints.pools}`);
    const response = await apiClient.get(API_CONFIG.endpoints.pools);
    console.log('Raw API response:', response);
    
    // Return the complete response data as it contains the pools array
    return response.data;
  } catch (error: any) {
    console.error('Error in fetchPools:', {
      message: error?.message || 'Unknown error',
      config: error?.config,
      response: error?.response?.data || 'No response data'
    });
    throw error;
  }
};

export const fetchPoolStats = async (poolId: string) => {
  try {
    const response = await apiClient.get(`${API_CONFIG.endpoints.pools}/${poolId}/stats`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching stats for pool ${poolId}:`, error);
    throw error;
  }
};

export const fetchBlocks = async (poolId: string, page = 0, pageSize = 10) => {
  try {
    const response = await apiClient.get(
      `${API_CONFIG.endpoints.blocks}?pool=${poolId}&page=${page}&pageSize=${pageSize}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching blocks:', error);
    throw error;
  }
};

export const fetchPayments = async (poolId: string, page = 0, pageSize = 10) => {
  try {
    const response = await apiClient.get(
      `${API_CONFIG.endpoints.payments}?pool=${poolId}&page=${page}&pageSize=${pageSize}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching payments:', error);
    throw error;
  }
};

export const fetchMinerStats = async (poolId: string, address: string) => {
  try {
    const response = await apiClient.get(
      `${API_CONFIG.endpoints.minerStats}/${poolId}/${address}`
    );
    return response.data;
  } catch (error) {
    console.error('Error fetching miner stats:', error);
    throw error;
  }
};

export const fetchNetworkStats = async () => {
  try {
    const response = await apiClient.get(API_CONFIG.endpoints.networkStats);
    return response.data;
  } catch (error) {
    console.error('Error fetching network stats:', error);
    throw error;
  }
};

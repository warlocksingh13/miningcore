export const API_CONFIG = {
  // Using the host's IP address for browser access
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
  endpoints: {
    // Updated to use the correct API paths for MiningCore
    pools: '/api/pools',
    blocks: '/api/blocks',
    payments: '/api/payments',
    minerStats: '/api/miners',
    networkStats: '/api/network/stats',
  },
  refreshInterval: 30000, // 30 seconds
};

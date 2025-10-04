/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://miningcore:4000'}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        // Match all API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // Increase timeout to 30 seconds
  staticPageGenerationTimeout: 30000,
  // Disable static optimization to ensure we always fetch fresh data
  output: 'standalone',
  // Enable React DevTools in production
  reactStrictMode: true,
  // Enable source maps in production for debugging
  productionBrowserSourceMaps: true,
  // Configure images if needed
  images: {
    domains: [],
    minimumCacheTTL: 60,
  },
  // Enable webpack 5
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Fixes npm packages that depend on `net` module
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        child_process: false
      };
    }
    return config;
  },
};

module.exports = nextConfig;

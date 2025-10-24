/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase body size limit for file uploads
  experimental: {
    serverComponentsExternalPackages: ['@supabase/supabase-js']
  },
  // Configure API routes
  api: {
    bodyParser: {
      sizeLimit: '25mb', // 25MB limit
    },
  },
  // Configure serverless function limits
  serverless: {
    // Increase timeout for file uploads
    timeout: 30,
  },
  // Headers for file uploads
  async headers() {
    return [
      {
        source: '/api/upload-supabase',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'POST, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

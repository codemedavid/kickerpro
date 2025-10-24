/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move serverComponentsExternalPackages to the correct location
  serverExternalPackages: ['@supabase/supabase-js'],
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

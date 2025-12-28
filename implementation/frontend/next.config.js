/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', '127.0.0.1:3000', '*.github.dev', '*.app.github.dev'],
    },
  },
  async rewrites() {
    const apiDestination =
      process.env.KOSMOS_INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://backend:8000';

    return [
      {
        source: '/api/:path*',
        destination: `${apiDestination}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

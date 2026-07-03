/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chymusic/shared'],
  experimental: {
    typedRoutes: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.ADMIN_API_URL || 'http://localhost:8001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

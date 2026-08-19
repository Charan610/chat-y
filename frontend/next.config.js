/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || '';
    if (backendUrl) {
      return [
        {
          source: '/api/:path((?!auth|user|users|chat|apikeys|conversations).*)',
          destination: `${backendUrl}/api/:path*`,
        },
        {
          source: '/uploads/:path*',
          destination: `${backendUrl}/uploads/:path*`,
        },
      ];
    }
    return [];
  },
}
module.exports = nextConfig

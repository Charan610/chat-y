/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
    if (backendUrl) {
      return [
        { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
        { source: '/uploads/:path*', destination: `${backendUrl}/uploads/:path*` },
      ];
    }
    // Development fallback
    if (process.env.NODE_ENV === 'development') {
      return [
        { source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' },
        { source: '/uploads/:path*', destination: 'http://localhost:8000/uploads/:path*' },
      ];
    }
    return [];
  },
}
module.exports = nextConfig

/** Frontend and API share an origin so session and CSRF cookies work. */
const backend = process.env.API_PROXY_TARGET || 'http://127.0.0.1:8000';
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/:path*` }];
  },
};
export default nextConfig;

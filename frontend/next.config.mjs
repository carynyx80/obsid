/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, webpack: (c) => { c.externals.push('pino-pretty', 'lokijs', 'encoding'); return c; } };
export default nextConfig;

// ============================================================
// Security headers — applied to every response from the dashboard.
// CSP intentionally not set here yet (would require auditing every
// inline script in the marketing site first). We do set the cheap
// wins: HSTS, frame-deny, content-type-sniff disable, referrer.
// ============================================================
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
  // HSTS only in prod; localhost can't ship over HTTPS.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains; preload' }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ai-receptionist/shared'],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  images: {
    domains: [],
  },
  env: {
    API_URL: process.env.API_URL ?? 'http://localhost:3001/api/v1',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: '/patients', destination: '/contacts', permanent: true },
      { source: '/patients/:id', destination: '/contacts/:id', permanent: true },
    ];
  },
  // The shared package uses NodeNext module resolution, which means its
  // imports look like `./foo.js` but the source files are `.ts`. Webpack
  // needs an extensionAlias to follow that convention.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
    };
    return config;
  },
};

module.exports = nextConfig;

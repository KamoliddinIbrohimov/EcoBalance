import path from 'node:path';
import { fileURLToPath } from 'node:url';

import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  devIndicators: false,
  // Monorepo: point tracing to workspace root so shared packages are bundled.
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@eco/shared'],
  // typedRoutes disabled until every route referenced by <Link> exists.
  // Re-enable in Phase 1 when the full route map is stable.
  typedRoutes: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Docker Desktop's Windows bind mount doesn't reliably forward native file
  // change events into the Linux container, so webpack's default watcher
  // silently misses edits. Polling guarantees changes are picked up.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: 'minio' },
      { protocol: 'https', hostname: '**.eco-balance.uz' },
    ],
  },
  async rewrites() {
    // Dev: nginx yo'q, API portiga to'g'ridan-to'g'ri proxy.
    // Prod: nginx handles /api/v1 → api:4000, so this never runs.
    const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
    return {
      beforeFiles: [],
      afterFiles: [
        {
          source: '/api/v1/:path*',
          destination: `${apiTarget}/api/v1/:path*`,
        },
      ],
      fallback: [],
    };
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import { z } from 'zod';

const publicEnvSchema = z.object({
  // Relative by default so the same build works in dev (proxied through nginx)
  // AND prod (also proxied through nginx). Set to an absolute URL when calling
  // an external API from a different origin.
  NEXT_PUBLIC_API_URL: z.string().min(1).default('/api/v1'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Eco-Balance'),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default('uz'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});

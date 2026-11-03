import { inject } from 'vitest';

import { testEnv } from './env';

Object.assign(process.env, testEnv(), { DATABASE_URL: inject('databaseUrl') });

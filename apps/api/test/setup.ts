import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-256-bit-test-secret';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-256-bit-test-secret';
process.env.JWT_ACCESS_TTL ??= '15m';
process.env.JWT_REFRESH_TTL ??= '7d';
process.env.COOKIE_DOMAIN ??= 'localhost';
process.env.COOKIE_SECURE ??= 'false';
process.env.CORS_ALLOWED_ORIGINS ??= 'http://localhost';

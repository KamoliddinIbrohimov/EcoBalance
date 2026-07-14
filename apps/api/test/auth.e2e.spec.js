"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const nestjs_zod_1 = require("nestjs-zod");
const supertest_1 = __importDefault(require("supertest"));
const vitest_1 = require("vitest");
const app_module_1 = require("../src/app.module");
const global_exception_filter_1 = require("../src/common/filters/global-exception.filter");
const response_transform_interceptor_1 = require("../src/common/interceptors/response-transform.interceptor");
const prisma_service_1 = require("../src/modules/prisma/prisma.service");
const strongPassword = 'ValidPass!2026';
(0, vitest_1.describe)('Auth (e2e)', () => {
    let app;
    let prisma;
    (0, vitest_1.beforeAll)(async () => {
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleRef.createNestApplication();
        app.use((0, cookie_parser_1.default)());
        app.setGlobalPrefix('api', { exclude: ['health'] });
        app.enableVersioning({ type: 1, defaultVersion: '1' });
        app.useGlobalPipes(new nestjs_zod_1.ZodValidationPipe());
        app.useGlobalInterceptors(new response_transform_interceptor_1.ResponseTransformInterceptor());
        app.useGlobalFilters(new global_exception_filter_1.GlobalExceptionFilter());
        await app.init();
        prisma = app.get(prisma_service_1.PrismaService);
        await prisma.user.deleteMany({ where: { email: { contains: '@test.eco-balance.uz' } } });
    });
    (0, vitest_1.afterAll)(async () => {
        await prisma.user.deleteMany({ where: { email: { contains: '@test.eco-balance.uz' } } });
        await app.close();
    });
    const uniqueEmail = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.eco-balance.uz`;
    (0, vitest_1.it)('POST /auth/register — 201 with valid payload', async () => {
        const email = uniqueEmail();
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
            firstName: 'Ali',
            lastName: 'Valiyev',
            email,
            password: strongPassword,
            confirmPassword: strongPassword,
        })
            .expect(201);
        (0, vitest_1.expect)(res.body.data.accessToken).toBeDefined();
        (0, vitest_1.expect)(res.body.data.tokenType).toBe('Bearer');
        (0, vitest_1.expect)(res.headers['set-cookie']?.some((c) => c.startsWith('refresh_token=')))
            .toBe(true);
    });
    (0, vitest_1.it)('POST /auth/register — 422 when password is weak', async () => {
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
            firstName: 'Ali',
            lastName: 'Valiyev',
            email: uniqueEmail(),
            password: 'weak',
            confirmPassword: 'weak',
        })
            .expect(422);
        (0, vitest_1.expect)(res.body.status).toBe(422);
        (0, vitest_1.expect)(res.body.errors).toBeDefined();
    });
    (0, vitest_1.it)('POST /auth/register — 409 when email already exists', async () => {
        const email = uniqueEmail();
        const payload = {
            firstName: 'Ali',
            lastName: 'Valiyev',
            email,
            password: strongPassword,
            confirmPassword: strongPassword,
        };
        await (0, supertest_1.default)(app.getHttpServer()).post('/api/v1/auth/register').send(payload).expect(201);
        await (0, supertest_1.default)(app.getHttpServer()).post('/api/v1/auth/register').send(payload).expect(409);
    });
    (0, vitest_1.it)('POST /auth/login — 200 with correct credentials', async () => {
        const email = uniqueEmail();
        await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
            firstName: 'Dilfuza',
            lastName: 'Makhmudova',
            email,
            password: strongPassword,
            confirmPassword: strongPassword,
        })
            .expect(201);
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email, password: strongPassword })
            .expect(200);
        (0, vitest_1.expect)(res.body.data.accessToken).toBeDefined();
    });
    (0, vitest_1.it)('POST /auth/login — 401 with wrong password', async () => {
        const email = uniqueEmail();
        await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
            firstName: 'X',
            lastName: 'Y',
            email,
            password: strongPassword,
            confirmPassword: strongPassword,
        })
            .expect(201);
        await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ email, password: 'WrongPass!2026' })
            .expect(401);
    });
    (0, vitest_1.it)('GET /auth/me — 200 with bearer token', async () => {
        const email = uniqueEmail();
        const reg = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
            firstName: 'Kamoliddin',
            lastName: 'Tester',
            email,
            password: strongPassword,
            confirmPassword: strongPassword,
        })
            .expect(201);
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
            .expect(200);
        (0, vitest_1.expect)(res.body.data.email).toBe(email);
        (0, vitest_1.expect)(res.body.data.roles).toContain('CITIZEN');
        (0, vitest_1.expect)(res.body.data.permissions).toContain('notifications.read.own');
    });
    (0, vitest_1.it)('GET /auth/me — 401 without token', async () => {
        await (0, supertest_1.default)(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
    (0, vitest_1.it)('POST /auth/refresh — 200 with valid refresh cookie', async () => {
        const email = uniqueEmail();
        const reg = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send({
            firstName: 'Refresh',
            lastName: 'Test',
            email,
            password: strongPassword,
            confirmPassword: strongPassword,
        })
            .expect(201);
        const cookie = reg.headers['set-cookie'];
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/refresh')
            .set('Cookie', cookie)
            .expect(200);
        (0, vitest_1.expect)(res.body.data.accessToken).toBeDefined();
    });
    (0, vitest_1.it)('POST /auth/refresh — 401 when no cookie', async () => {
        await (0, supertest_1.default)(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
    });
    (0, vitest_1.it)('POST /auth/forgot-password — 200 (does not leak account existence)', async () => {
        const res = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/v1/auth/forgot-password')
            .send({ email: 'nobody@test.eco-balance.uz' })
            .expect(200);
        (0, vitest_1.expect)(res.body.data.ok).toBe(true);
    });
});
//# sourceMappingURL=auth.e2e.spec.js.map
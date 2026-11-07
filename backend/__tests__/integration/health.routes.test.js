process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// server.js unconditionally loads backend/.env (with `override: true`) on
// require. A real .env may exist locally with live third-party API keys
// (Roboflow/Groq/Hugging Face/Google Places/Supabase/...) - loading those
// into the test process would make the suite network-dependent and
// non-deterministic, and could leak into other test files that reuse this
// same Jest worker process. Stubbing dotenv keeps every test run hermetic
// regardless of what's in a developer's local .env.
jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('../../config/supabase', () => ({
  supabase: require('../../test/utils/supabaseMock').createSupabaseMock(),
}));

const request = require('supertest');
const app = require('../../server');

describe('GET /health', () => {
  test('reports OK with a timestamp', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'OK' });
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('GET /', () => {
  test('returns the API welcome message and mounted route list', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/CivicStack/);
    expect(Array.isArray(res.body.endpoints)).toBe(true);
  });
});

describe('404 handler', () => {
  test('an unknown route returns a structured 404, not an HTML stack trace', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('security headers (helmet)', () => {
  test('responses include baseline helmet security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

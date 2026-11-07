process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// See health.routes.test.js for why dotenv is stubbed here.
jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('../../config/supabase', () => ({
  supabase: require('../../test/utils/supabaseMock').createSupabaseMock(),
}));

const request = require('supertest');
const app = require('../../server');

describe('POST /api/emotion/analyze', () => {
  test('analyzes a genuine complaint and returns a structured emotion score (happy path)', async () => {
    const res = await request(app).post('/api/emotion/analyze').send({
      text: 'Dangerous open electric wire near the school, children are at serious risk, please act urgently.',
      category: 'fallen_electric_pole',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.emotionScore).toBe('number');
    expect(res.body.data.emotions).toHaveProperty('urgency');
  });

  test('rejects an empty text body (boundary/validation case)', async () => {
    const res = await request(app).post('/api/emotion/analyze').send({ text: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('rejects a missing text field entirely', async () => {
    const res = await request(app).post('/api/emotion/analyze').send({});
    expect(res.status).toBe(400);
  });

  test('rejects a whitespace-only text body', async () => {
    const res = await request(app).post('/api/emotion/analyze').send({ text: '    ' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/emotion/test', () => {
  test('runs the three built-in multilingual smoke cases and returns a result for each', async () => {
    const res = await request(app).get('/api/emotion/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.testResults).toHaveLength(3);
    res.body.testResults.forEach((r) => expect(r.status).toBe('success'));
  });
});

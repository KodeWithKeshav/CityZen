process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// See health.routes.test.js for why dotenv is stubbed here.
jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('../../config/supabase', () => ({
  supabase: require('../../test/utils/supabaseMock').createSupabaseMock(),
}));

// The explain/status routes talk to the Python DistilBERT service over HTTP.
// Mock axios so these tests never need the service (or the model) to be running.
jest.mock('axios');
const axios = require('axios');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');

const tokenFor = (userType) =>
  jwt.sign({ userId: `${userType}-1`, email: `${userType}@example.com`, userType }, process.env.JWT_SECRET);
const adminToken = tokenFor('admin');
const citizenToken = tokenFor('citizen');

const SAMPLE_EXPLANATION = {
  label: 'NEGATIVE',
  score: 0.9991,
  target: 'NEGATIVE',
  base_value: 0.41,
  output_value: 0.9991,
  words: [
    { text: 'dangerous', start: 12, end: 21, shap: 0.31 },
    { text: 'road', start: 4, end: 8, shap: 0.02 },
  ],
  top_positive: [{ text: 'dangerous', shap: 0.31 }],
  top_negative: [],
  method: 'shap.Explainer(partition, text masker)',
};

beforeEach(() => {
  axios.post.mockReset();
  axios.get.mockReset();
});

describe('POST /api/emotion/explain (SHAP, admin only)', () => {
  test('requires authentication', async () => {
    const res = await request(app).post('/api/emotion/explain').send({ text: 'The road is dangerous' });
    expect(res.status).toBe(401);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('forbids non-admin (citizen) callers', async () => {
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ text: 'The road is dangerous' });
    expect(res.status).toBe(403);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('returns the SHAP explanation for an admin (happy path) and defaults the target to NEGATIVE', async () => {
    axios.post.mockResolvedValueOnce({ data: SAMPLE_EXPLANATION });
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: '  The road is dangerous  ' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.words[0]).toMatchObject({ text: 'dangerous', shap: 0.31 });

    const [url, payload] = axios.post.mock.calls[0];
    expect(url).toMatch(/\/explain$/);
    expect(payload).toMatchObject({ text: 'The road is dangerous', target: 'NEGATIVE' });
  });

  test('passes an explicit POSITIVE target and tuning knobs through to the service', async () => {
    axios.post.mockResolvedValueOnce({ data: { ...SAMPLE_EXPLANATION, target: 'POSITIVE' } });
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Thanks for fixing it', target: 'positive', maxEvals: 120, topK: 3 });

    expect(res.status).toBe(200);
    expect(axios.post.mock.calls[0][1]).toMatchObject({ target: 'POSITIVE', max_evals: 120, top_k: 3 });
  });

  test.each([
    ['empty text', { text: '' }],
    ['whitespace-only text', { text: '    ' }],
    ['missing text', {}],
    ['non-string text', { text: 42 }],
    ['unknown target label', { text: 'The road is dangerous', target: 'ANGRY' }],
    ['text over the length cap', { text: 'x'.repeat(2001) }],
  ])('rejects %s with 400 and never calls the model', async (_name, body) => {
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('answers 503 with a helpful message when the Python service is not running', async () => {
    axios.post.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5001'), { code: 'ECONNREFUSED' }));
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'The road is dangerous' });
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not running|no local model/i);
  });

  test('relays the service\'s own 503 reason (e.g. local self-test failed) as detail', async () => {
    axios.post.mockRejectedValueOnce({
      message: 'Request failed with status code 503',
      response: { status: 503, data: { error: 'SHAP explanations need the local DistilBERT backend', detail: 'local self-test failed: killed by signal SIGBUS' } },
    });
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'The road is dangerous' });
    expect(res.status).toBe(503);
    expect(res.body.detail).toMatch(/SIGBUS/);
  });

  test('maps an unexpected upstream failure to 502', async () => {
    axios.post.mockRejectedValueOnce({ message: 'boom', response: { status: 500, data: { error: 'Explanation failed' } } });
    const res = await request(app)
      .post('/api/emotion/explain')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'The road is dangerous' });
    expect(res.status).toBe(502);
  });
});

describe('GET /api/emotion/model-status (admin only)', () => {
  test('requires an admin', async () => {
    expect((await request(app).get('/api/emotion/model-status')).status).toBe(401);
    expect((await request(app).get('/api/emotion/model-status').set('Authorization', `Bearer ${citizenToken}`)).status).toBe(403);
  });

  test('reports the live backend, device and SHAP availability', async () => {
    axios.get.mockResolvedValueOnce({ data: { status: 'ok', backend: 'local', device: 'cpu', shap: true } });
    const res = await request(app).get('/api/emotion/model-status').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reachable: true, backend: 'local', device: 'cpu', shap: true });
  });

  test('reports why the local model is off when the service answers 503', async () => {
    axios.get.mockRejectedValueOnce({
      message: 'Request failed with status code 503',
      response: { status: 503, data: { status: 'unavailable', error: 'local self-test failed: killed by signal SIGBUS' } },
    });
    const res = await request(app).get('/api/emotion/model-status').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reachable: true, status: 'unavailable' });
    expect(res.body.data.error).toMatch(/SIGBUS/);
  });

  test('reports reachable:false when the service is down', async () => {
    axios.get.mockRejectedValueOnce(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
    const res = await request(app).get('/api/emotion/model-status').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ reachable: false, status: 'down' });
  });
});

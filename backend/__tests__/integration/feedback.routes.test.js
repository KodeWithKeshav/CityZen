process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// See health.routes.test.js for why dotenv is stubbed here.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const { createSupabaseMock } = require('../../test/utils/supabaseMock');
const mockSupabase = createSupabaseMock();
jest.mock('../../config/supabase', () => ({ supabase: mockSupabase }));

const request = require('supertest');
const app = require('../../server');

beforeEach(() => mockSupabase.reset());

describe('POST /api/feedback/submit', () => {
  test('records feedback for an existing complaint (happy path)', async () => {
    mockSupabase.queueResult('complaints', { data: { id: 'complaint-1', title: 'Pothole on Main St' }, error: null });
    mockSupabase.queueResult('complaint_feedback', { data: [{ id: 'fb-1' }], error: null });

    const res = await request(app).post('/api/feedback/submit').send({ complaintId: 'complaint-1', rating: 5, feedback: 'Fixed quickly, thank you!' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.feedbackId).toBe('fb-1');
  });

  test('rejects a missing complaintId (boundary/validation case)', async () => {
    const res = await request(app).post('/api/feedback/submit').send({ rating: 4 });
    expect(res.status).toBe(400);
  });

  test('rejects a missing rating', async () => {
    const res = await request(app).post('/api/feedback/submit').send({ complaintId: 'complaint-1' });
    expect(res.status).toBe(400);
  });

  test.each([6, -1, 10])('rejects an out-of-range rating value: %p (boundary case)', async (rating) => {
    const res = await request(app).post('/api/feedback/submit').send({ complaintId: 'complaint-1', rating });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rating must be between 1 and 5/i);
  });

  test('rejects rating: 0 (boundary case - falsy value is caught by the earlier required-field check)', async () => {
    // `if (!complaintId || !rating)` treats a rating of 0 as "missing"
    // (0 is falsy in JS) before the explicit 1-5 range check ever runs -
    // still a 400, just via the "required fields" message rather than the
    // "must be between 1 and 5" one.
    const res = await request(app).post('/api/feedback/submit').send({ complaintId: 'complaint-1', rating: 0 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/complaintId and rating are required/i);
  });

  test.each([1, 5])('accepts the inclusive rating boundary values: %p', async (rating) => {
    mockSupabase.queueResult('complaints', { data: { id: 'complaint-1', title: 'Pothole' }, error: null });
    mockSupabase.queueResult('complaint_feedback', { data: [{ id: 'fb-x' }], error: null });
    const res = await request(app).post('/api/feedback/submit').send({ complaintId: 'complaint-1', rating });
    expect(res.status).toBe(201);
  });

  test('returns 404 when the referenced complaint does not exist', async () => {
    mockSupabase.queueResult('complaints', { data: null, error: { message: 'not found' } });
    const res = await request(app).post('/api/feedback/submit').send({ complaintId: 'does-not-exist', rating: 3 });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/feedback/stats', () => {
  test('aggregates total count, average rating, and the 1-5 rating distribution', async () => {
    mockSupabase.queueResult('complaint_feedback', {
      data: [{ rating: 5 }, { rating: 5 }, { rating: 3 }, { rating: 1 }],
      error: null,
    });
    mockSupabase.queueResult('complaint_feedback', { data: [], error: null }); // recent feedback query

    const res = await request(app).get('/api/feedback/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.totalFeedback).toBe(4);
    expect(res.body.data.averageRating).toBeCloseTo((5 + 5 + 3 + 1) / 4, 2);
    expect(res.body.data.ratingDistribution).toEqual({ 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 });
  });

  test('reports zero feedback gracefully instead of dividing by zero (boundary case)', async () => {
    mockSupabase.queueResult('complaint_feedback', { data: [], error: null });
    mockSupabase.queueResult('complaint_feedback', { data: [], error: null });

    const res = await request(app).get('/api/feedback/stats');
    expect(res.status).toBe(200);
    expect(res.body.data.totalFeedback).toBe(0);
    expect(res.body.data.averageRating).toBe(0);
  });
});

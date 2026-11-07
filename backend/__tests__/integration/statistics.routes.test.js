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

describe('GET /api/statistics/summary', () => {
  test('counts complaints by status bucket (happy path)', async () => {
    mockSupabase.queueResult('complaints', {
      data: [
        { status: 'pending' }, { status: 'pending' },
        { status: 'in_progress' },
        { status: 'resolved' }, { status: 'completed' },
      ],
      error: null,
    });

    const res = await request(app).get('/api/statistics/summary');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, total: 5, pending: 2, inProgress: 1, resolved: 2 });
  });

  test('returns all-zero counts for an empty complaints table (boundary case)', async () => {
    mockSupabase.queueResult('complaints', { data: [], error: null });
    const res = await request(app).get('/api/statistics/summary');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, pending: 0, inProgress: 0, resolved: 0 });
  });

  test('is case-insensitive about status values', async () => {
    mockSupabase.queueResult('complaints', { data: [{ status: 'PENDING' }, { status: 'Resolved' }], error: null });
    const res = await request(app).get('/api/statistics/summary');
    expect(res.body).toMatchObject({ pending: 1, resolved: 1 });
  });

  test('surfaces a database error as a 500 instead of crashing', async () => {
    mockSupabase.queueResult('complaints', { data: null, error: { message: 'connection lost' } });
    const res = await request(app).get('/api/statistics/summary');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/statistics/debug', () => {
  test('returns a per-status breakdown with a truncated ID/title sample', async () => {
    mockSupabase.queueResult('complaints', {
      data: [{ id: 'abcdefgh-1234', status: 'pending', title: 'A very long complaint title that gets truncated for the debug view' }],
      error: null,
    });
    const res = await request(app).get('/api/statistics/debug');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.statusCounts.pending).toBe(1);
  });
});

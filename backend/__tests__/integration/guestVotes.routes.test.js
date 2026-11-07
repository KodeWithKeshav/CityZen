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

describe('POST /api/guest-votes (anonymous voting)', () => {
  test('rejects a request missing complaintId (boundary/validation case)', async () => {
    const res = await request(app).post('/api/guest-votes').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 404 for a complaint that does not exist', async () => {
    mockSupabase.queueResult('complaints', { data: null, error: { message: 'not found' } });
    const res = await request(app).post('/api/guest-votes').send({ complaintId: 'does-not-exist' });
    expect(res.status).toBe(404);
  });

  test('registers a guest vote for an existing complaint (happy path)', async () => {
    mockSupabase.queueResult('complaints', { data: { id: 'complaint-1' }, error: null }); // existence check
    // deviceIdColumnAvailable probe result (cached process-wide after the
    // first call - see services/schemaAvailability.js)
    mockSupabase.queueResult('complaint_votes', { error: null });
    // toggleUpvote: findExistingVote may or may not run depending on dedupe
    // availability; queue enough generically-shaped results either way.
    mockSupabase.queueResults('complaint_votes', [
      { data: null, error: null }, // findExistingVote (if dedupe available)
      { error: null },             // insert
      { count: 1, error: null },   // recompute
    ]);
    mockSupabase.queueResult('complaints', { data: null, error: null }); // persist vote_count

    const res = await request(app).post('/api/guest-votes').send({ complaintId: 'complaint-1', deviceId: 'device-abc' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('voteCount');
    expect(typeof res.body.data.deduped).toBe('boolean');
  });

  test('two concurrent anonymous votes with no deviceId both succeed independently (concurrency/boundary case)', async () => {
    // No deviceId -> identity = {}, toggleUpvote always treats it as "not
    // yet voted" (no stable identity to dedupe against, so findExistingVote
    // short-circuits without even querying). Each request consumes one
    // 'complaints' result for its existence check and one more for
    // recomputeVoteCount's persisted-count update, plus two
    // 'complaint_votes' results (insert, then the recount). Since both
    // requests run concurrently their consumption order isn't fully
    // deterministic, so every queued result is shaped to satisfy whichever
    // of the two call sites consumes it.
    mockSupabase.queueResults('complaints', [
      { data: { id: 'complaint-2' }, error: null },
      { data: { id: 'complaint-2' }, error: null },
      { data: { id: 'complaint-2' }, error: null },
      { data: { id: 'complaint-2' }, error: null },
    ]);
    mockSupabase.queueResults('complaint_votes', [
      { error: null, count: 1 },
      { error: null, count: 1 },
      { error: null, count: 2 },
      { error: null, count: 2 },
    ]);

    const [r1, r2] = await Promise.all([
      request(app).post('/api/guest-votes').send({ complaintId: 'complaint-2' }),
      request(app).post('/api/guest-votes').send({ complaintId: 'complaint-2' }),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r1.body.data.action).toBe('voted');
    expect(r2.body.data.action).toBe('voted');
  });
});

describe('GET /api/guest-votes/status/:complaintId', () => {
  test('returns 404 for a nonexistent complaint', async () => {
    mockSupabase.queueResult('complaints', { data: null, error: { message: 'not found' } });
    const res = await request(app).get('/api/guest-votes/status/does-not-exist');
    expect(res.status).toBe(404);
  });

  test('returns the vote count for an existing complaint', async () => {
    mockSupabase.queueResult('complaints', { data: { vote_count: 12 }, error: null });
    const res = await request(app).get('/api/guest-votes/status/complaint-1');
    expect(res.status).toBe(200);
    expect(res.body.data.voteCount).toBe(12);
  });
});

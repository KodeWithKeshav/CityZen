/**
 * System / end-to-end test: a realistic cross-tier CityZen workflow driven
 * entirely through the real Express app (via supertest) with Supabase
 * mocked at the data-access boundary - every route, validation rule,
 * middleware pass, and business-logic service (priority/emotion/
 * authenticity/vote/dashboard aggregation) runs for real; only the database
 * and third-party AI network calls are stubbed, following this repo's own
 * existing precedent for not exercising live third-party APIs in automated
 * tests (see services/__tests__/cityzenWorkflow.smoke.test.js).
 *
 * Scenario: a citizen registers, logs in, drafts a complaint and gets
 * AI pre-submission feedback on it, a second (guest) citizen upvotes an
 * existing complaint, the original citizen leaves resolution feedback, and
 * an admin reviews both dashboards plus the public transparency view.
 */
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// See __tests__/integration/health.routes.test.js for why dotenv is stubbed.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const { createSupabaseMock } = require('../../test/utils/supabaseMock');
const mockSupabase = createSupabaseMock();
jest.mock('../../config/supabase', () => ({ supabase: mockSupabase }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');

beforeEach(() => mockSupabase.reset());

describe('Citizen + admin cross-tier journey', () => {
  test('full workflow: signup -> login -> draft analysis -> guest vote -> feedback -> admin review', async () => {
    // ---- 1. Citizen registers ----------------------------------------
    mockSupabase.queueResult('users', { data: null, error: null }); // no existing account
    mockSupabase.queueResult('users', {
      data: {
        id: 'citizen-1', email: 'journey.citizen@example.com', full_name: 'Journey Citizen',
        phone_number: '9876543210', user_type: 'citizen', address: null,
      },
      error: null,
    });
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'journey.citizen@example.com',
      password: 'secure-password-1',
      fullName: 'Journey Citizen',
      phoneNumber: '9876543210',
      userType: 'citizen',
    });
    expect(signupRes.status).toBe(201);
    const signupToken = signupRes.body.data.token;

    // ---- 2. Citizen logs in separately (independent of the signup token) ----
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('secure-password-1', 10);
    mockSupabase.queueResult('users', {
      data: {
        id: 'citizen-1', email: 'journey.citizen@example.com', password: hashedPassword,
        full_name: 'Journey Citizen', phone_number: '9876543210', user_type: 'citizen',
        address: null, is_active: true,
      },
      error: null,
    });
    mockSupabase.queueResult('users', { data: null, error: null }); // last_login update
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'journey.citizen@example.com', password: 'secure-password-1',
    });
    expect(loginRes.status).toBe(200);
    const sessionToken = loginRes.body.data.token;
    expect(jwt.verify(sessionToken, process.env.JWT_SECRET).email).toBe('journey.citizen@example.com');

    // ---- 3. Citizen fetches their profile with the session token ------
    mockSupabase.queueResult('users', {
      data: {
        id: 'citizen-1', email: 'journey.citizen@example.com', full_name: 'Journey Citizen',
        phone_number: '9876543210', user_type: 'citizen', address: null, created_at: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });
    const profileRes = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${sessionToken}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.data.user.id).toBe('citizen-1');

    // ---- 4. Citizen drafts a complaint and gets pre-submission AI feedback ----
    const draftRes = await request(app).post('/api/complaints/analyze-text').send({
      description: 'There is a dangerous fallen electric pole near the school gate, live wires exposed, extremely urgent.',
      category: 'fallen_electric_pole',
    });
    expect(draftRes.status).toBe(200);
    expect(draftRes.body.success).toBe(true);
    expect(draftRes.body.emotion.emotionScore).toBeGreaterThan(0);
    expect(draftRes.body.authenticity.flagged).toBe(false);

    // ---- 5. A second, anonymous citizen upvotes an existing complaint ----
    mockSupabase.queueResult('complaints', { data: { id: 'complaint-99' }, error: null }); // existence check
    mockSupabase.queueResult('complaint_votes', { error: null }); // deviceIdColumnAvailable probe
    mockSupabase.queueResult('complaint_votes', { data: null, error: null }); // findExistingVote
    mockSupabase.queueResult('complaint_votes', { error: null }); // insert
    mockSupabase.queueResult('complaint_votes', { count: 4, error: null }); // recompute
    mockSupabase.queueResult('complaints', { data: null, error: null }); // persist vote_count
    const voteRes = await request(app).post('/api/guest-votes').send({ complaintId: 'complaint-99', deviceId: 'device-journey-1' });
    expect(voteRes.status).toBe(200);
    expect(voteRes.body.data.voteCount).toBe(4);

    // ---- 6. The original citizen leaves feedback on a resolved complaint ----
    mockSupabase.queueResult('complaints', { data: { id: 'complaint-99', title: 'Fallen pole near school' }, error: null });
    mockSupabase.queueResult('complaint_feedback', { data: [{ id: 'feedback-1' }], error: null });
    const feedbackRes = await request(app).post('/api/feedback/submit').send({
      complaintId: 'complaint-99', rating: 5, feedback: 'Resolved within a day, great response.',
    });
    expect(feedbackRes.status).toBe(201);
    expect(feedbackRes.body.data.feedbackId).toBe('feedback-1');

    // ---- 7. An admin reviews the enhanced dashboard overview -----------
    mockSupabase.queueResult('complaints', {
      data: [
        { id: 'complaint-99', status: 'resolved', priority_score: 0.91, category: 'fallen_electric_pole', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'complaint-100', status: 'pending', priority_score: 0.4, category: 'pothole', created_at: '2026-01-02T00:00:00.000Z' },
      ],
      error: null,
    });
    const adminOverviewRes = await request(app).get('/api/admin-enhanced/dashboard/overview');
    expect(adminOverviewRes.status).toBe(200);
    expect(adminOverviewRes.body.data.overview.totalComplaints).toBe(2);
    expect(adminOverviewRes.body.data.overview.resolvedComplaints).toBe(1);

    // ---- 8. The admin also checks the basic admin dashboard -----------
    mockSupabase.queueResult('complaints', {
      data: [
        { id: 'complaint-99', status: 'resolved', priority_score: 0.91, created_at: '2026-01-01T00:00:00.000Z', resolved_at: '2026-01-01T12:00:00.000Z', category: 'fallen_electric_pole' },
      ],
      error: null,
    });
    mockSupabase.queueResult('users', { data: [{ id: 'citizen-1', user_type: 'citizen' }], error: null });
    const adminBasicRes = await request(app).get('/api/admin/dashboard');
    expect(adminBasicRes.status).toBe(200);
    expect(adminBasicRes.body.success).toBe(true);

    // ---- 9. The public transparency dashboard reflects the same data --
    mockSupabase.queueResult('complaints', {
      data: [
        { id: 'complaint-99', status: 'resolved', category: 'fallen_electric_pole', created_at: '2026-01-01T00:00:00.000Z', resolved_at: '2026-01-01T12:00:00.000Z', priority_score: 0.91, vote_count: 4 },
        { id: 'complaint-100', status: 'pending', category: 'pothole', created_at: '2026-01-02T00:00:00.000Z', resolved_at: null, priority_score: 0.4, vote_count: 1 },
      ],
      error: null,
    });
    const transparencyRes = await request(app).get('/api/transparency/dashboard');
    expect(transparencyRes.status).toBe(200);
    expect(transparencyRes.body.success).toBe(true);
  });

  test('an unauthenticated citizen cannot reach their profile, and a tampered token is rejected mid-journey (negative path)', async () => {
    const noAuthRes = await request(app).get('/api/auth/profile');
    expect(noAuthRes.status).toBe(401);

    const tamperedToken = jwt.sign({ userId: 'citizen-1', userType: 'admin' }, 'not-the-real-secret');
    const tamperedRes = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${tamperedToken}`);
    expect(tamperedRes.status).toBe(401);
  });

  test('a citizen cannot vote on, or leave feedback for, a complaint that does not exist (negative path)', async () => {
    mockSupabase.queueResult('complaints', { data: null, error: { message: 'not found' } });
    const voteRes = await request(app).post('/api/guest-votes').send({ complaintId: 'ghost-complaint' });
    expect(voteRes.status).toBe(404);

    mockSupabase.queueResult('complaints', { data: null, error: { message: 'not found' } });
    const feedbackRes = await request(app).post('/api/feedback/submit').send({ complaintId: 'ghost-complaint', rating: 4 });
    expect(feedbackRes.status).toBe(404);
  });
});

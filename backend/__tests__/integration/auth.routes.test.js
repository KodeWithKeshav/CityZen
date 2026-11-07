process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// See health.routes.test.js for why dotenv is stubbed here.
jest.mock('dotenv', () => ({ config: jest.fn() }));

const { createSupabaseMock } = require('../../test/utils/supabaseMock');

// Variable names must start with "mock" to be referenced inside a
// jest.mock() factory - babel-jest's hoist plugin special-cases this
// prefix since jest.mock() calls are hoisted above regular requires.
const mockSupabase = createSupabaseMock();
jest.mock('../../config/supabase', () => ({ supabase: mockSupabase }));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');

beforeEach(() => mockSupabase.reset());

describe('POST /api/auth/signup', () => {
  const validBody = {
    email: 'new.citizen@example.com',
    password: 'password123',
    fullName: 'New Citizen',
    phoneNumber: '9876543210',
    userType: 'citizen',
  };

  test('creates an account and returns a signed JWT (happy path)', async () => {
    mockSupabase.queueResult('users', { data: null, error: null }); // no existing user
    mockSupabase.queueResult('users', {
      data: {
        id: 'user-1', email: validBody.email, full_name: validBody.fullName,
        phone_number: validBody.phoneNumber, user_type: 'citizen', address: null,
      },
      error: null,
    });

    const res = await request(app).post('/api/auth/signup').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(validBody.email);
    const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(decoded.email).toBe(validBody.email);
  });

  test('rejects an email that already exists (business-rule boundary)', async () => {
    mockSupabase.queueResult('users', { data: { id: 'existing-user' }, error: null });
    const res = await request(app).post('/api/auth/signup').send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  test.each([
    ['missing email', { ...validBody, email: undefined }],
    ['invalid email format', { ...validBody, email: 'not-an-email' }],
    ['password too short', { ...validBody, password: '123' }],
    ['full name too short', { ...validBody, fullName: 'A' }],
    ['phone number too short', { ...validBody, phoneNumber: '123' }],
    ['invalid userType', { ...validBody, userType: 'superadmin' }],
  ])('rejects invalid input: %s (boundary/validation case)', async (_label, body) => {
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  test('rejects a completely empty request body', async () => {
    const res = await request(app).post('/api/auth/signup').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  const bcrypt = require('bcryptjs');

  test('logs in with correct credentials and returns a JWT (happy path)', async () => {
    const hashed = await bcrypt.hash('correct-password', 10);
    mockSupabase.queueResult('users', {
      data: {
        id: 'user-1', email: 'citizen@example.com', password: hashed,
        full_name: 'Citizen One', phone_number: '9876543210', user_type: 'citizen',
        address: null, is_active: true,
      },
      error: null,
    });
    mockSupabase.queueResult('users', { data: null, error: null }); // last_login update

    const res = await request(app).post('/api/auth/login').send({ email: 'citizen@example.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('citizen@example.com');
    expect(typeof res.body.data.token).toBe('string');
  });

  test('rejects an incorrect password without revealing whether the account exists (auth-failure boundary)', async () => {
    const bcryptHash = await bcrypt.hash('the-real-password', 10);
    mockSupabase.queueResult('users', {
      data: { id: 'user-1', email: 'citizen@example.com', password: bcryptHash, is_active: true },
      error: null,
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'citizen@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  test('rejects a nonexistent account with the same generic message (no user enumeration)', async () => {
    mockSupabase.queueResult('users', { data: null, error: { message: 'no rows' } });
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  test('rejects a missing password field (validation boundary)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'citizen@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/profile (auth-failure boundary cases)', () => {
  test('returns 401 when no Authorization header is sent', async () => {
    const res = await request(app).get('/api/auth/profile');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  test('returns 401 for a malformed/invalid JWT', async () => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
  });

  test('returns 401 for a well-formed JWT signed with the wrong secret', async () => {
    const forgedToken = jwt.sign({ userId: 'someone' }, 'a-different-secret');
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
  });

  test('returns the profile for a valid token (happy path)', async () => {
    const token = jwt.sign({ userId: 'user-1', email: 'citizen@example.com', userType: 'citizen' }, process.env.JWT_SECRET, { expiresIn: '7d' });
    mockSupabase.queueResult('users', {
      data: { id: 'user-1', email: 'citizen@example.com', full_name: 'Citizen One', phone_number: '9876543210', user_type: 'citizen', address: null, created_at: '2026-01-01T00:00:00.000Z' },
      error: null,
    });
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe('user-1');
  });

  test('returns 404 when the token is valid but the user no longer exists', async () => {
    const token = jwt.sign({ userId: 'deleted-user' }, process.env.JWT_SECRET);
    mockSupabase.queueResult('users', { data: null, error: { message: 'not found' } });
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

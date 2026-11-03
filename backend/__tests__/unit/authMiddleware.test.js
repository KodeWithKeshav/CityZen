process.env.JWT_SECRET = 'test-jwt-secret';

jest.mock('../../config/supabase', () => ({
  supabase: require('../../test/utils/supabaseMock').createSupabaseMock(),
}));

const jwt = require('jsonwebtoken');
const { authenticateUser, authorizeUserType } = require('../../middleware/auth');

function mockReqRes(headers = {}) {
  const req = { header: (name) => headers[name] };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

describe('authenticateUser (permissive auth middleware)', () => {
  test('attaches no user and continues when no Authorization header is present', async () => {
    const { req, res } = mockReqRes();
    const next = jest.fn();
    await authenticateUser(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull(); // never responds itself
  });

  test('attaches the decoded user for a valid token', async () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', userType: 'citizen' }, process.env.JWT_SECRET);
    const { req, res } = mockReqRes({ Authorization: `Bearer ${token}` });
    const next = jest.fn();
    await authenticateUser(req, res, next);
    expect(req.user).toMatchObject({ id: 'u1', email: 'a@b.com', userType: 'citizen', isAuthenticated: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('continues as anonymous (does not throw/reject) for a malformed token (boundary/error case)', async () => {
    const { req, res } = mockReqRes({ Authorization: 'Bearer complete-garbage-token' });
    const next = jest.fn();
    await authenticateUser(req, res, next);
    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test('continues as anonymous for a token signed with a different secret', async () => {
    const forged = jwt.sign({ userId: 'attacker' }, 'wrong-secret');
    const { req, res } = mockReqRes({ Authorization: `Bearer ${forged}` });
    const next = jest.fn();
    await authenticateUser(req, res, next);
    expect(req.user).toBeNull();
  });

  test('continues as anonymous for an expired token', async () => {
    const expired = jwt.sign({ userId: 'u1' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const { req, res } = mockReqRes({ Authorization: `Bearer ${expired}` });
    const next = jest.fn();
    await authenticateUser(req, res, next);
    expect(req.user).toBeNull();
  });
});

describe('authorizeUserType (role-gate middleware)', () => {
  test('returns 401 for an unauthenticated request', () => {
    const { req, res } = mockReqRes();
    req.user = null;
    const next = jest.fn();
    authorizeUserType(['admin'])(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 403 when the authenticated user\'s type is not in the allow-list', () => {
    const { req, res } = mockReqRes();
    req.user = { id: 'u1', userType: 'citizen', isAuthenticated: true };
    const next = jest.fn();
    authorizeUserType(['admin'])(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next() when the user type is allowed', () => {
    const { req, res } = mockReqRes();
    req.user = { id: 'admin-1', userType: 'admin', isAuthenticated: true };
    const next = jest.fn();
    authorizeUserType(['admin', 'citizen'])(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });
});

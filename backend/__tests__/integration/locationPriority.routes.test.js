process.env.JWT_SECRET = 'test-jwt-secret';
process.env.NODE_ENV = 'test';

// See health.routes.test.js for why dotenv is stubbed here.
jest.mock('dotenv', () => ({ config: jest.fn() }));

jest.mock('../../config/supabase', () => ({
  supabase: require('../../test/utils/supabaseMock').createSupabaseMock(),
}));

const request = require('supertest');
const app = require('../../server');

// These tests deliberately stay on the request-validation branch of
// POST /calculate, which returns before any outbound call to Google
// Places/OpenStreetMap - the success path depends on a live third-party
// API and is intentionally not exercised here (see
// services/__tests__/cityzenWorkflow.smoke.test.js for this repo's existing
// pattern of guarding real third-party calls behind a credential check).
describe('POST /api/location-priority/calculate (boundary & validation)', () => {
  test('rejects a request missing latitude/longitude', async () => {
    const res = await request(app).post('/api/location-priority/calculate').send({ complaintType: 'pothole' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_COORDINATES');
  });

  test('rejects a request missing complaintType', async () => {
    const res = await request(app).post('/api/location-priority/calculate').send({ latitude: 13.08, longitude: 80.27 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_COMPLAINT_TYPE');
  });

  test('rejects non-numeric coordinates', async () => {
    const res = await request(app).post('/api/location-priority/calculate').send({
      latitude: '13.08', longitude: '80.27', complaintType: 'pothole',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATE_TYPE');
  });

  test('rejects an out-of-range latitude (boundary: beyond ±90)', async () => {
    const res = await request(app).post('/api/location-priority/calculate').send({
      latitude: 95, longitude: 80.27, complaintType: 'pothole',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_COORDINATE_RANGE');
  });

  test('rejects a valid coordinate outside India\'s service area (e.g. London)', async () => {
    const res = await request(app).post('/api/location-priority/calculate').send({
      latitude: 51.5074, longitude: -0.1278, complaintType: 'pothole',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('OUTSIDE_SERVICE_AREA');
  });

  test('rejects an unrecognized complaintType', async () => {
    const res = await request(app).post('/api/location-priority/calculate').send({
      latitude: 13.0827, longitude: 80.2707, complaintType: 'alien_invasion',
    });
    expect(res.status).toBe(400);
  });

});

describe('POST /api/location-priority/calculate-bulk (boundary & validation)', () => {
  test('rejects a non-array locations field', async () => {
    const res = await request(app).post('/api/location-priority/calculate-bulk').send({ locations: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_LOCATIONS');
  });

  test('rejects an empty locations array', async () => {
    const res = await request(app).post('/api/location-priority/calculate-bulk').send({ locations: [] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_LOCATIONS');
  });

  test('rejects more than 10 locations (boundary: max batch size)', async () => {
    const locations = Array.from({ length: 11 }, (_, i) => ({ latitude: 13, longitude: 80, complaintType: 'pothole', id: `loc-${i}` }));
    const res = await request(app).post('/api/location-priority/calculate-bulk').send({ locations });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOO_MANY_LOCATIONS');
  });
});

describe('GET /api/location-priority/info', () => {
  test('returns the static service-capability payload', async () => {
    const res = await request(app).get('/api/location-priority/info');
    expect(res.status).toBe(200);
    expect(res.body.service.status).toBe('operational');
    expect(res.body.privacyLevels).toHaveProperty('exact');
    expect(res.body.privacyLevels).toHaveProperty('street');
    expect(res.body.privacyLevels).toHaveProperty('area');
  });
});

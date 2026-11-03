const { createSupabaseMock } = require('../../test/utils/supabaseMock');
const { findNearbyDuplicateComplaint, DUPLICATE_RADIUS_M } = require('../../services/duplicateComplaintService');

// Chennai, Anna Salai (used throughout as a fixed reference point)
const LAT = 13.0827;
const LNG = 80.2707;

function metersToLatDelta(m) { return m / 111320; }

describe('findNearbyDuplicateComplaint', () => {
  let supabase;
  beforeEach(() => { supabase = createSupabaseMock(); });

  test('returns null immediately for missing/invalid inputs without querying the database', async () => {
    const result = await findNearbyDuplicateComplaint({ supabase, category: null, latitude: LAT, longitude: LNG });
    expect(result).toBeNull();
    expect(supabase.getCalls()).toHaveLength(0);

    const result2 = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: NaN, longitude: LNG });
    expect(result2).toBeNull();
  });

  test('returns null when no candidates are found nearby', async () => {
    supabase.queueResult('complaints', { data: [], error: null });
    const result = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: LAT, longitude: LNG });
    expect(result).toBeNull();
  });

  test('returns null (fails soft) on a database error rather than throwing', async () => {
    supabase.queueResult('complaints', { data: null, error: { message: 'connection reset' } });
    const result = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: LAT, longitude: LNG });
    expect(result).toBeNull();
  });

  test('picks the closest of several nearby candidates and attaches _distanceMeters', async () => {
    const near = { id: 'near', location_latitude: LAT + metersToLatDelta(10), location_longitude: LNG };
    const far = { id: 'far', location_latitude: LAT + metersToLatDelta(35), location_longitude: LNG };
    supabase.queueResult('complaints', { data: [far, near], error: null });

    const result = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: LAT, longitude: LNG });
    expect(result.id).toBe('near');
    expect(result._distanceMeters).toBeGreaterThan(0);
    expect(result._distanceMeters).toBeLessThan(DUPLICATE_RADIUS_M);
  });

  test('excludes a candidate outside the duplicate radius (boundary case)', async () => {
    // ~41m away, just past the default 40m radius
    const tooFar = { id: 'too-far', location_latitude: LAT + metersToLatDelta(41), location_longitude: LNG };
    supabase.queueResult('complaints', { data: [tooFar], error: null });

    const result = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: LAT, longitude: LNG });
    expect(result).toBeNull();
  });

  test('ignores a candidate with a non-numeric stored location instead of crashing', async () => {
    const malformed = { id: 'bad-coords', location_latitude: 'not-a-number', location_longitude: LNG };
    const valid = { id: 'ok', location_latitude: LAT + metersToLatDelta(5), location_longitude: LNG };
    supabase.queueResult('complaints', { data: [malformed, valid], error: null });

    const result = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: LAT, longitude: LNG });
    expect(result.id).toBe('ok');
  });

  test('honors a custom radiusMeters override', async () => {
    const candidate = { id: 'c1', location_latitude: LAT + metersToLatDelta(80), location_longitude: LNG };
    supabase.queueResult('complaints', { data: [candidate], error: null });

    const resultDefaultRadius = await findNearbyDuplicateComplaint({ supabase, category: 'pothole', latitude: LAT, longitude: LNG });
    expect(resultDefaultRadius).toBeNull();

    supabase.queueResult('complaints', { data: [candidate], error: null });
    const resultWideRadius = await findNearbyDuplicateComplaint({
      supabase, category: 'pothole', latitude: LAT, longitude: LNG, radiusMeters: 100,
    });
    expect(resultWideRadius.id).toBe('c1');
  });
});

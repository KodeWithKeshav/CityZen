const { createSupabaseMock } = require('../../test/utils/supabaseMock');
const { castUpvote, toggleUpvote, recomputeVoteCount } = require('../../services/voteService');

describe('recomputeVoteCount', () => {
  let supabase;
  beforeEach(() => { supabase = createSupabaseMock(); });

  test('counts upvotes and persists the count back onto the complaint', async () => {
    supabase.queueResult('complaint_votes', { count: 7, error: null });
    supabase.queueResult('complaints', { data: null, error: null });

    const count = await recomputeVoteCount(supabase, 'complaint-1');
    expect(count).toBe(7);

    const updateCall = supabase.getCalls().find((c) => c.table === 'complaints' && c.op === 'update');
    expect(updateCall.values).toEqual({ vote_count: 7 });
  });

  test('returns null (fails soft) if the count query errors', async () => {
    supabase.queueResult('complaint_votes', { count: null, error: { message: 'boom' } });
    const count = await recomputeVoteCount(supabase, 'complaint-1');
    expect(count).toBeNull();
  });

  test('treats a null count as zero votes, not a crash (boundary case)', async () => {
    supabase.queueResult('complaint_votes', { count: null, error: null });
    supabase.queueResult('complaints', { data: null, error: null });
    const count = await recomputeVoteCount(supabase, 'complaint-1');
    expect(count).toBe(0);
  });
});

describe('castUpvote', () => {
  let supabase;
  beforeEach(() => { supabase = createSupabaseMock(); });

  test('inserts a new upvote when the identity has not voted yet', async () => {
    supabase.queueResult('complaint_votes', { data: null, error: null }); // findExistingVote -> maybeSingle
    supabase.queueResult('complaint_votes', { error: null }); // insert
    supabase.queueResult('complaint_votes', { count: 1, error: null }); // recompute
    supabase.queueResult('complaints', { data: null, error: null }); // persist count

    const result = await castUpvote(supabase, 'c1', { userId: 'u1' });
    expect(result.alreadyVoted).toBe(false);
    expect(result.voteCount).toBe(1);

    const insertCall = supabase.getCalls().find((c) => c.table === 'complaint_votes' && c.op === 'insert');
    expect(insertCall.rows[0]).toMatchObject({ complaint_id: 'c1', vote_type: 'upvote', user_id: 'u1' });
  });

  test('no-ops (does not insert again) when the identity already has an upvote', async () => {
    supabase.queueResult('complaint_votes', { data: { id: 'vote-1', vote_type: 'upvote' }, error: null });
    supabase.queueResult('complaint_votes', { count: 3, error: null });
    supabase.queueResult('complaints', { data: null, error: null });

    const result = await castUpvote(supabase, 'c1', { userId: 'u1' });
    expect(result.alreadyVoted).toBe(true);

    const insertCall = supabase.getCalls().find((c) => c.table === 'complaint_votes' && c.op === 'insert');
    expect(insertCall).toBeUndefined();
  });

  test('flips an existing downvote to an upvote', async () => {
    supabase.queueResult('complaint_votes', { data: { id: 'vote-1', vote_type: 'downvote' }, error: null });
    supabase.queueResult('complaint_votes', { error: null }); // update
    supabase.queueResult('complaint_votes', { count: 2, error: null });
    supabase.queueResult('complaints', { data: null, error: null });

    const result = await castUpvote(supabase, 'c1', { userId: 'u1' });
    expect(result.alreadyVoted).toBe(false);
    const updateCall = supabase.getCalls().find((c) => c.table === 'complaint_votes' && c.op === 'update');
    expect(updateCall.values).toEqual({ vote_type: 'upvote' });
  });

  test('a guest with no stable identity ({}) is always treated as not-yet-voted', async () => {
    supabase.queueResult('complaint_votes', { error: null }); // insert (no existing-vote lookup happens)
    supabase.queueResult('complaint_votes', { count: 1, error: null });
    supabase.queueResult('complaints', { data: null, error: null });

    const result = await castUpvote(supabase, 'c1', {});
    expect(result.alreadyVoted).toBe(false);
  });

  test('propagates a database error from the insert instead of swallowing it', async () => {
    supabase.queueResult('complaint_votes', { data: null, error: null });
    supabase.queueResult('complaint_votes', { error: { message: 'insert failed' } });
    await expect(castUpvote(supabase, 'c1', { userId: 'u1' })).rejects.toThrow('insert failed');
  });
});

describe('toggleUpvote', () => {
  let supabase;
  beforeEach(() => { supabase = createSupabaseMock(); });

  test('voting for the first time inserts an upvote and returns action "voted"', async () => {
    supabase.queueResult('complaint_votes', { data: null, error: null });
    supabase.queueResult('complaint_votes', { error: null });
    supabase.queueResult('complaint_votes', { count: 1, error: null });
    supabase.queueResult('complaints', { data: null, error: null });

    const result = await toggleUpvote(supabase, 'c1', { userId: 'u1' });
    expect(result).toEqual({ action: 'voted', userVoted: true, voteCount: 1 });
  });

  test('voting again removes the existing upvote and returns action "unvoted"', async () => {
    supabase.queueResult('complaint_votes', { data: { id: 'vote-1', vote_type: 'upvote' }, error: null });
    supabase.queueResult('complaint_votes', { error: null }); // delete
    supabase.queueResult('complaint_votes', { count: 0, error: null });
    supabase.queueResult('complaints', { data: null, error: null });

    const result = await toggleUpvote(supabase, 'c1', { userId: 'u1' });
    expect(result).toEqual({ action: 'unvoted', userVoted: false, voteCount: 0 });

    const deleteCall = supabase.getCalls().find((c) => c.table === 'complaint_votes' && c.op === 'delete');
    expect(deleteCall).toBeDefined();
  });

  test('two concurrent toggle calls for the same device both resolve without throwing (concurrency/boundary case)', async () => {
    // Each call gets its own queued "no existing vote" + insert + recompute
    // sequence - this models two near-simultaneous requests from the same
    // guest device hitting the (mocked) database independently, which is
    // the realistic concurrency surface for this stateless service function.
    supabase.queueResults('complaint_votes', [
      { data: null, error: null }, { error: null }, { count: 1, error: null },
      { data: null, error: null }, { error: null }, { count: 2, error: null },
    ]);
    supabase.queueResults('complaints', [{ data: null, error: null }, { data: null, error: null }]);

    const [r1, r2] = await Promise.all([
      toggleUpvote(supabase, 'c1', { deviceId: 'device-1' }),
      toggleUpvote(supabase, 'c1', { deviceId: 'device-1' }),
    ]);
    expect(r1.action).toBe('voted');
    expect(r2.action).toBe('voted');
  });
});

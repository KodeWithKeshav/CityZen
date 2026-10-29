/**
 * A minimal fake of the @supabase/supabase-js query-builder chain, shared by
 * every integration/system test so route and service code under test can
 * `require('../config/supabase')` (or receive it via `req.app.get('supabase')`)
 * exactly as it does in production, without touching a real database.
 *
 * Usage:
 *   const { createSupabaseMock } = require('../../test/utils/supabaseMock');
 *   const supabase = createSupabaseMock();
 *   jest.mock('../../config/supabase', () => ({ supabase: require('.../supabaseMock')... }))
 *
 * Every `.from(table)` chain (`.select()/.insert()/.update()/.delete()`,
 * any number of `.eq()/.gte()/.order()/...` filters, then either an awaited
 * terminal like `.single()`/`.maybeSingle()`, or awaiting the chain object
 * itself - both patterns are used across the real route files) resolves to
 * the next `{ data, error, count }` result queued for that table with
 * `queueResult(table, result)`. Results are consumed FIFO per table, so a
 * handler that makes two different queries against the same table needs two
 * results queued, in the order the handler issues them.
 */
function createSupabaseMock() {
  const queues = {};
  const calls = [];

  function queueResult(table, result) {
    if (!queues[table]) queues[table] = [];
    queues[table].push(result);
    return mock;
  }

  function queueResults(table, results) {
    results.forEach((r) => queueResult(table, r));
    return mock;
  }

  function nextResult(table) {
    const q = queues[table];
    if (q && q.length) return q.shift();
    // Sensible default so an un-stubbed call fails soft (empty result)
    // instead of throwing, matching how most routes treat "no rows".
    return { data: null, error: null, count: 0 };
  }

  function makeBuilder(table, op) {
    const record = { table, op, filters: [] };
    calls.push(record);

    const builder = {
      select(...args) { record.select = args; return builder; },
      insert(rows) { record.op = 'insert'; record.rows = rows; return builder; },
      update(values) { record.op = 'update'; record.values = values; return builder; },
      upsert(rows) { record.op = 'upsert'; record.rows = rows; return builder; },
      delete() { record.op = 'delete'; return builder; },
      eq(col, val) { record.filters.push(['eq', col, val]); return builder; },
      neq(col, val) { record.filters.push(['neq', col, val]); return builder; },
      gt(col, val) { record.filters.push(['gt', col, val]); return builder; },
      gte(col, val) { record.filters.push(['gte', col, val]); return builder; },
      lt(col, val) { record.filters.push(['lt', col, val]); return builder; },
      lte(col, val) { record.filters.push(['lte', col, val]); return builder; },
      in(col, vals) { record.filters.push(['in', col, vals]); return builder; },
      not(col, op2, val) { record.filters.push(['not', col, op2, val]); return builder; },
      or(expr) { record.filters.push(['or', expr]); return builder; },
      ilike(col, val) { record.filters.push(['ilike', col, val]); return builder; },
      like(col, val) { record.filters.push(['like', col, val]); return builder; },
      order(col, opts) { record.filters.push(['order', col, opts]); return builder; },
      limit(n) { record.filters.push(['limit', n]); return builder; },
      range(from, to) { record.filters.push(['range', from, to]); return builder; },
      single() { return Promise.resolve(nextResult(table)); },
      maybeSingle() { return Promise.resolve(nextResult(table)); },
      // Makes the builder itself awaitable for code that does
      // `await supabase.from(x).update(y).eq(...)` without a terminal call.
      then(resolve, reject) {
        return Promise.resolve(nextResult(table)).then(resolve, reject);
      },
      catch(reject) {
        return Promise.resolve(nextResult(table)).catch(reject);
      },
    };
    return builder;
  }

  const mock = {
    from(table) { return makeBuilder(table); },
    rpc(fnName, args) {
      calls.push({ rpc: fnName, args });
      return Promise.resolve(nextResult(`rpc:${fnName}`));
    },
    queueResult,
    queueResults,
    getCalls: () => calls,
    reset() {
      Object.keys(queues).forEach((k) => delete queues[k]);
      calls.length = 0;
    },
  };

  return mock;
}

module.exports = { createSupabaseMock };

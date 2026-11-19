import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import * as core from '../public/community/rnc/labuu-run-core.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const secret = 'runner-checkpoint-tests-only';
function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, { module, exports: module.exports, require: name => {
    assert(name in dependencies, 'Unexpected dependency: ' + name); return dependencies[name];
  }, ...globals });
  return module.exports;
}
const policy = load('../lib/community-collection-policy.ts', {});
function harness() {
  let now = Date.UTC(2026, 10, 19, 12);
  class Clock extends Date {
    constructor(value) { super(value === undefined ? now : value); }
    static now() { return now; }
  }
  const writes = [], locks = [], row = { bestScore: 50, bestAt: null };
  const checkpoints = load('../lib/community-labuu-run-checkpoint.ts', {
    'node:crypto': crypto, '@/lib/community-collection-policy': policy,
    '@/public/community/rnc/labuu-run-core.mjs': core,
  }, { Buffer, Date: Clock, process: { env: { COMMUNITY_SESSION_SECRET: secret } } });
  const tx = {
    $queryRaw: async (...query) => { locks.push(query); return []; },
    communityLabuuRunScore: {
      findUnique: async () => ({ ...row }),
      update: async query => { writes.push(query); Object.assign(row, query.data); return { bestScore: row.bestScore }; },
    },
  };
  const api = load('../lib/community-labuu-run.ts', {
    'node:crypto': { randomUUID: () => '0000007b-0000-4000-8000-000000000001', randomInt: () => 123 },
    '@/lib/community-collection-policy': policy,
    '@/lib/community-arcade-leaderboard': { ARCADE_LEADERBOARD_LIMIT: 10, rankArcadeScores: entries => entries },
    '@/lib/community-asset-urls': {}, '@/public/community/rnc/labuu-run-leaderboard-seeds.json': [],
    '@/public/community/rnc/labuu-run-core.mjs': core,
    '@/lib/community-labuu-run-checkpoint': checkpoints,
    '@/lib/db': { prisma: {
      communityCharacter: { findMany: async () => [] },
      communityLabuuRunScore: { upsert: async query => { Object.assign(row, query.update); return { bestScore: row.bestScore }; } },
      $transaction: callback => callback(tx),
    } },
  }, { Date: Clock });
  const start = (version = core.RUNNER_RULES_VERSION) => api.startLabuuRun('guild', 'player', version);
  const advanceClock = tick => { now = row.startedAt.getTime() + tick * core.STEP_MS + 1; };
  return { api, checkpoints, row, writes, locks, start, advanceClock, addTime: ms => { now += ms; } };
}
function shortRun() {
  const run = core.createRun(123, core.RUNNER_RULES_VERSION);
  core.jump(run);
  while (run.tick < 10) core.stepRun(run);
  assert(core.dive(run));
  while (!run.ended) core.stepRun(run);
  return run;
}
// Server-signed fixture near the old time boundary, with no upcoming hazards.
function signFixture(token, transform) {
  const data = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  transform(data);
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const proof = crypto.createHmac('sha256', secret).update('RNC:labuu-run-checkpoint:v1:').update(body).digest('base64url');
  return body + '.' + proof;
}

test('new rounds continue past 43,044 while old speed-rule rounds still end at their original ten minutes', () => {
  for (const version of [core.FAST_RULES_VERSION, core.RUNNER_RULES_VERSION]) {
    const run = core.createRun(123, version);
    run.nextSpawn = Number.MAX_SAFE_INTEGER;
    for (let index = 0; index < core.MAX_TICKS + 120; index++) core.stepRun(run);
    if (version === core.FAST_RULES_VERSION) { assert.equal(run.ended, true); assert.equal(run.score, 43044); }
    else { assert.equal(run.ended, false); assert.equal(run.hit, false); assert(run.score > 43044); }
  }
});

test('endless rounds retain the speed curve and upper speed of previous fast rounds', () => {
  for (const tick of [0, 100, 1000, 10000, 36000, 500000]) {
    assert.equal(core.runnerSpeed(tick, core.RUNNER_RULES_VERSION), core.runnerSpeed(tick, core.FAST_RULES_VERSION));
  }
});

test('dive reverses ascent, lands earlier, cannot be cancelled in air and resets on the ground', () => {
  const run = core.createRun(123, core.RUNNER_RULES_VERSION);
  assert.equal(core.dive(run), false);
  core.jump(run);
  for (let i = 0; i < 10; i++) core.stepRun(run);
  const normal = structuredClone(run);
  assert(core.dive(run));
  assert(run.velocity < 0);
  assert.equal(core.dive(run), false);
  assert.equal(core.jump(run), false);
  while (run.y > 0) { core.stepRun(run); core.stepRun(normal); }
  assert(normal.y > 0);
  assert.equal(run.diving, false);
  assert.equal(run.jumps, 0);
  assert(core.jump(run));
  run.ended = true;
  assert.equal(core.dive(run), false);
  const legacy = core.createRun(123, core.FAST_RULES_VERSION);
  core.jump(legacy); core.stepRun(legacy);
  assert.equal(core.dive(legacy), false);
});

test('deterministic segment replay includes dives and rejects reordered, duplicated, impossible or missing actions', () => {
  const run = shortRun(), initial = core.createRun(123, core.RUNNER_RULES_VERSION);
  assert.equal(core.replaySegment(initial, run.tick, [0], [10], true)?.score, run.score);
  assert.equal(initial.tick, 0, 'Replay should not mutate its checkpoint');
  for (const [jumps, dives] of [[[0, 0], [10]], [[0], [0]], [[0], [11, 10]], [[0], [run.tick]], [[], [10]], [[0], Array(2401).fill(10)]]) {
    assert.equal(core.replaySegment(initial, run.tick, jumps, dives, true), null);
  }
  assert.equal(core.replaySegment(initial, core.MAX_TICKS + 1, [], [], false), null);
  assert.equal(core.replaySegment(initial, 50, [0], [10], true), null, 'An alive state is not a finished score');
});

test('checkpoint progress and final crash replay save the same score once under a row lock', async () => {
  const h = harness(), started = await h.start(), run = shortRun();
  h.advanceClock(50);
  const chunk = await h.checkpoints.checkpointLabuuRun('guild', 'player', { roundId: started.roundId, checkpoint: started.checkpoint, finishTick: 50, jumps: [0], dives: [10] });
  assert.equal(h.writes.length, 0, 'Checkpoints do not write score rows');
  const paused = await h.checkpoints.checkpointLabuuRun('guild', 'player', { roundId: started.roundId, checkpoint: chunk.checkpoint, finishTick: 50, jumps: [], dives: [] });
  assert.equal(paused.checkpointTick, 50, 'Renewing paused progress must not advance the score');
  h.advanceClock(run.tick);
  const body = { roundId: started.roundId, checkpoint: chunk.checkpoint, finishTick: run.tick, jumps: [], dives: [] };
  const result = await h.api.finishLabuuRun('guild', 'player', body);
  assert.equal(result.score, run.score);
  assert.equal(result.bestScore, run.score);
  assert.equal((await h.api.finishLabuuRun('guild', 'player', body)).score, run.score);
  assert.equal(h.writes.length, 1);
  assert.equal(h.locks.length, 2);
});

test('verified checkpoints cross the old tick limit and remain renewable beyond the old one-hour round expiry', async () => {
  const h = harness(), started = await h.start();
  let checkpoint = signFixture(started.checkpoint, data => {
    data.run.tick = core.MAX_TICKS - 10; data.run.distance = 430430; data.run.score = 43043;
    data.run.nextSpawn = Number.MAX_SAFE_INTEGER;
  });
  h.advanceClock(core.MAX_TICKS + 10);
  const crossed = await h.checkpoints.checkpointLabuuRun('guild', 'player', { roundId: started.roundId, checkpoint, finishTick: core.MAX_TICKS + 10, jumps: [], dives: [] });
  checkpoint = crossed.checkpoint;
  let tick = crossed.checkpointTick;
  for (let index = 0; index < 15; index++) {
    tick += core.CHECKPOINT_TICKS;
    h.advanceClock(tick);
    const result = await h.checkpoints.checkpointLabuuRun('guild', 'player', { roundId: started.roundId, checkpoint, finishTick: tick, jumps: [], dives: [] });
    checkpoint = result.checkpoint;
  }
  assert(tick * core.STEP_MS > 3_600_000);
  assert.equal(h.writes.length, 0);
  checkpoint = signFixture(checkpoint, data => {
    data.run.obstacles = [{ motion: 'ground', x: core.PLAYER_X, previousX: core.PLAYER_X,
      width: 55, height: 62, pace: 1, sprite: 0, spawnedAt: tick, hopAt: null, dropAt: null }];
  });
  h.advanceClock(tick + 1);
  const saved = await h.api.finishLabuuRun('guild', 'player', { roundId: started.roundId, checkpoint, finishTick: tick + 1, jumps: [], dives: [] });
  assert(saved.score > 43044);
  assert.equal(saved.bestScore, saved.score);
});

test('checkpoint signatures bind player, guild and round, reject speed-ups, expiry and oversized segments', async () => {
  const h = harness(), start = await h.start();
  const valid = { roundId: start.roundId, checkpoint: start.checkpoint, finishTick: 10, jumps: [], dives: [] };
  await assert.rejects(h.checkpoints.checkpointLabuuRun('guild', 'player', { ...valid, finishTick: 100 }), /timing/);
  h.advanceClock(10);
  for (const [guild, player, body] of [
    ['other', 'player', valid], ['guild', 'other', valid],
    ['guild', 'player', { ...valid, roundId: 'other' }],
    ['guild', 'player', { ...valid, checkpoint: valid.checkpoint + 'tampered' }],
    ['guild', 'player', { ...valid, checkpoint: 'x'.repeat(24001) }],
  ]) await assert.rejects(h.checkpoints.checkpointLabuuRun(guild, player, body), /checkpoint/);
  h.advanceClock(core.MAX_TICKS + 1);
  await assert.rejects(h.checkpoints.checkpointLabuuRun('guild', 'player', { ...valid, finishTick: core.MAX_TICKS + 1 }), /match/);
  h.addTime(3_600_001);
  await assert.rejects(h.checkpoints.checkpointLabuuRun('guild', 'player', valid), error => error.status === 410);
});

test('old version-five rounds are issued and saved with their existing replay contract', async () => {
  const h = harness(), started = await h.start(core.FAST_RULES_VERSION);
  assert.equal(started.rulesVersion, core.FAST_RULES_VERSION);
  assert.equal(started.checkpoint, undefined);
  const run = core.createRun(started.seed, started.rulesVersion);
  while (!run.ended) core.stepRun(run);
  h.advanceClock(run.tick);
  const result = await h.api.finishLabuuRun('guild', 'player', { roundId: started.roundId, finishTick: run.tick, jumps: [] });
  assert.equal(result.score, run.score);
});

test('a replaced round or a nonterminal run cannot publish an endless score', async () => {
  const h = harness(), start = await h.start();
  h.advanceClock(10);
  const body = { roundId: start.roundId, checkpoint: start.checkpoint, finishTick: 10, jumps: [], dives: [] };
  await assert.rejects(h.api.finishLabuuRun('guild', 'player', body), /match/);
  h.row.roundId = 'replaced';
  await assert.rejects(h.api.finishLabuuRun('guild', 'player', body), error => error.status === 409);
  assert.equal(h.writes.length, 0);
});

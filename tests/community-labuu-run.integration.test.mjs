import '../scripts/community-module-loader.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import dotenv from 'dotenv';
const local = dotenv.parse(readFileSync(new URL('../.env.local', import.meta.url)));
if (!local.DATABASE_URL || !['localhost','127.0.0.1','[::1]'].includes(new URL(local.DATABASE_URL).hostname)) throw Error('Runner integration tests require a localhost database');
Object.assign(process.env, local);
process.env.COMMUNITY_SESSION_SECRET = 'runner-local-integration-only';
const { prisma } = await import('../lib/db.ts');
const api = await import('../lib/community-labuu-run.ts');
const checkpointApi = await import('../lib/community-labuu-run-checkpoint.ts');
const core = await import('../public/community/rnc/labuu-run-core.mjs');
const prefix = 'runner-test-' + randomUUID();
const guildId = prefix, userIds = [];
const signFixture = (token, transform) => {
  const data = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
  transform(data);
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  return body + '.' + createHmac('sha256', process.env.COMMUNITY_SESSION_SECRET).update('RNC:labuu-run-checkpoint:v1:').update(body).digest('base64url');
};

test('runner integration: checkpoint replay, score persistence and legacy rounds', async t => {
  try {
    const user = await prisma.communityUser.create({ data: { discordId: prefix, username: 'runner-fixture', displayName: 'Runner fixture' } });
    userIds.push(user.id);
    const key = { guildId_userId: { guildId, userId: user.id } };
    await t.test('a real signed checkpoint and dive replay save only on game over, with idempotent retries', async () => {
      const start = await api.startLabuuRun(guildId,user.id,core.RUNNER_RULES_VERSION);
      const row = await prisma.communityLabuuRunScore.findUniqueOrThrow({ where: key });
      const run = core.createRun(start.seed,start.rulesVersion);
      core.jump(run);
      while(run.tick<10) core.stepRun(run);
      core.dive(run);
      while(!run.ended) core.stepRun(run);
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,row.startedAt.getTime()+run.tick*core.STEP_MS-Date.now()+30)));
      const progress = await checkpointApi.checkpointLabuuRun(guildId,user.id,{roundId:start.roundId,checkpoint:start.checkpoint,finishTick:50,jumps:[0],dives:[10]});
      assert.equal((await prisma.communityLabuuRunScore.findUniqueOrThrow({where:key})).lastScore,null);
      const body = {roundId:start.roundId,checkpoint:progress.checkpoint,finishTick:run.tick,jumps:[],dives:[]};
      const saved = await api.finishLabuuRun(guildId,user.id,body);
      assert.equal(saved.score,run.score);
      assert.deepEqual(await api.finishLabuuRun(guildId,user.id,body),saved);
      assert.equal((await prisma.communityLabuuRunScore.findUniqueOrThrow({where:key})).bestScore,run.score);
    });
    await t.test('a fixture past 43,044 and the old wall-clock expiry persists to the real score column', async () => {
      const start=await api.startLabuuRun(guildId,user.id,core.RUNNER_RULES_VERSION);
      const startedAt=new Date(Date.now()-3_700_000);
      await prisma.communityLabuuRunScore.update({where:key,data:{startedAt}});
      const checkpoint=signFixture(checkpointApi.issueRunnerCheckpoint(guildId,user.id,start.roundId,start.seed,startedAt),data=>{
        data.run.tick=core.MAX_TICKS+10;data.run.distance=430600;data.run.score=43060;
        data.run.nextSpawn=Number.MAX_SAFE_INTEGER;
        data.run.obstacles=[{motion:'ground',x:core.PLAYER_X,previousX:core.PLAYER_X,width:55,height:62,pace:1,sprite:0,spawnedAt:data.run.tick,hopAt:null,dropAt:null}];
      });
      const saved=await api.finishLabuuRun(guildId,user.id,{roundId:start.roundId,checkpoint,finishTick:core.MAX_TICKS+11,jumps:[],dives:[]});
      assert(saved.score>43044);
      assert.equal((await prisma.communityLabuuRunScore.findUniqueOrThrow({where:key})).bestScore,saved.score);
    });
    await t.test('an older version-five round still saves and preserves the existing higher record',async()=>{
      const previous=await prisma.communityLabuuRunScore.findUniqueOrThrow({where:key});
      const start=await api.startLabuuRun(guildId,user.id,core.FAST_RULES_VERSION);
      assert.equal(start.rulesVersion,core.FAST_RULES_VERSION);
      const row=await prisma.communityLabuuRunScore.findUniqueOrThrow({where:key}),run=core.createRun(start.seed,start.rulesVersion);
      while(!run.ended)core.stepRun(run);
      await new Promise(resolve=>setTimeout(resolve,Math.max(0,row.startedAt.getTime()+run.tick*core.STEP_MS-Date.now()+30)));
      const saved=await api.finishLabuuRun(guildId,user.id,{roundId:start.roundId,finishTick:run.tick,jumps:[]});
      assert.equal(saved.score,run.score);assert.equal(saved.bestScore,previous.bestScore);
    });
  } finally {
    if(userIds.length)await prisma.communityUser.deleteMany({where:{id:{in:userIds},discordId:{startsWith:prefix}}});
    assert.equal(await prisma.communityLabuuRunScore.count({where:{guildId}}),0,'Temporary score rows must be cleaned');
    await prisma.$disconnect();
  }
});

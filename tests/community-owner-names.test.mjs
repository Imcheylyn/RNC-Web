import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as crypto from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
import assetUrls from './helpers/community-asset-urls.mjs';

const secret = 'owner-name-test-secret-only';
const key = crypto.createHash('sha256').update('Project-LinuxOS:RNC:community:v1:').update(secret).digest();
const plain = value => JSON.parse(JSON.stringify(value));
function load(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const { outputText } = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  vm.runInNewContext(outputText, {
    module, exports: module.exports, require: name => {
      assert(name in dependencies, 'Unexpected dependency: ' + name);
      return dependencies[name];
    }, ...globals,
  });
  return module.exports;
}
const policy = load('../lib/community-session-policy.ts', {});
function seal(stored) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(stored), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}
function open(value) {
  const [iv, tag, bytes] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(bytes), decipher.final()]).toString('utf8'));
}
const cookieValue = text => text.slice(text.indexOf('=') + 1).split(';')[0];
const storedSession = (extra = {}) => ({
  userId: 'owner', discordId: '12345', username: 'discord.account', avatarHash: null,
  name: 'Global display', accessToken: 'test-access', roles: [], guildNickname: 'ชื่อในเซิร์ฟเวอร์',
  checkedAt: Date.now(), expiresAt: Date.now() + 3_600_000, ...extra,
});
function request(url, cookies = {}) {
  return { url, headers: new Headers(), cookies: { get: name => cookies[name] ? { value: cookies[name] } : undefined } };
}
function harness(options = {}) {
  const calls = [], queries = [], warnings = [];
  const control = { nickname: 'ชื่อในเซิร์ฟเวอร์', globalName: 'Global display', roles: [], ...options };
  const user = { id: 'owner', discordId: '12345', username: 'discord.account', displayName: 'Global display', avatarHash: null };
  const api = load('../lib/community-auth.ts', {
    'node:crypto': crypto,
    'next/server': { NextResponse: { redirect: (url, status) => new Response(null, { status, headers: { location: String(url) } }) } },
    '@/lib/community-session-policy': policy,
    '@/lib/db': { prisma: { communityUser: {
      upsert: async query => { queries.push(['upsert', plain(query)]); Object.assign(user, query.update); return { ...user }; },
      updateMany: async query => {
        queries.push(['updateMany', plain(query)]);
        if (control.databaseFailure) throw Error('Simulated unavailable database');
        if (user.id === query.where.id && user.displayName !== query.where.displayName.not) {
          user.displayName = query.data.displayName; return { count: 1 };
        }
        return { count: 0 };
      },
    } } },
  }, {
    Buffer, URL, URLSearchParams, AbortSignal,
    process: { env: {
      COMMUNITY_DISCORD_CLIENT_ID: 'client', COMMUNITY_DISCORD_CLIENT_SECRET: 'secret',
      COMMUNITY_DISCORD_REDIRECT_URI: 'https://rnc.test/auth/discord/callback',
      COMMUNITY_SESSION_SECRET: secret, COMMUNITY_GUILD_ID: 'rnc-guild', COMMUNITY_STAFF_ROLE_ID: 'staff-role',
    } },
    console: { warn: (...args) => warnings.push(args), error: (...args) => warnings.push(args) },
    fetch: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/oauth2/token')) return Response.json({ access_token: 'test-access', token_type: 'Bearer', expires_in: 3600, scope: 'identify guilds.members.read' });
      if (url.endsWith('/users/@me')) return Response.json({ id: '12345', username: 'discord.account', global_name: control.globalName, avatar: null });
      assert.equal(url, 'https://discord.com/api/v10/users/@me/guilds/rnc-guild/member');
      return Response.json(control.membershipStatus ? { message: 'Simulated membership error' } : { nick: control.nickname, roles: control.roles }, { status: control.membershipStatus || 200 });
    },
  });
  async function login() {
    const start = api.startDiscordOAuth(request('https://rnc.test/auth/discord'));
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const response = await api.completeDiscordOAuth(request('https://rnc.test/auth/discord/callback?code=test-code&state=' + state, { rnc_oauth_state: state }));
    assert.equal(response.headers.get('location'), 'https://rnc.test/community/rnc');
    const cookie = response.headers.getSetCookie().find(text => text.startsWith('rnc_session='));
    assert(cookie, 'Login should issue a session cookie');
    return cookieValue(cookie);
  }
  const session = (value, force = false) => api.getCommunitySession(request('https://rnc.test/community/rnc', { rnc_session: value }), force);
  return { api, calls, queries, warnings, user, control, login, session };
}

test('OAuth stores the server nickname for character owners while preserving the Discord account username', async () => {
  const h = harness({ nickname: '  เจ้าของตัวละคร ✦  ' });
  const cookie = await h.login();
  assert.equal(h.user.displayName, 'เจ้าของตัวละคร ✦');
  assert.equal(h.user.username, 'discord.account');
  assert.equal(h.queries[0][1].create.displayName, 'เจ้าของตัวละคร ✦');
  assert.equal(open(cookie).name, 'Global display', 'Keep the global name for removing the server nickname later');
  const result = await h.session(cookie);
  assert.equal(result.session.name, 'เจ้าของตัวละคร ✦');
  assert.equal(result.cookie, undefined);
  assert.equal(h.calls.length, 3, 'Cached visits must not call Discord again');
  assert.equal(h.queries.length, 1, 'Cached visits must not write the name again');
});

test('users without a server nickname fall back to global display name, then username', async () => {
  for (const [nickname, globalName, expected] of [[null, 'Global display', 'Global display'], ['   ', 'Global display', 'Global display'], [null, null, 'discord.account']]) {
    const h = harness({ nickname, globalName });
    const cookie = await h.login();
    assert.equal(h.user.displayName, expected);
    assert.equal((await h.session(cookie)).session.name, expected);
  }
});

test('existing sessions sync their verified server nickname once without another membership request', async () => {
  const h = harness();
  const result = await h.session(seal(storedSession()));
  assert.equal(result.session.name, 'ชื่อในเซิร์ฟเวอร์');
  assert.equal(h.user.displayName, result.session.name);
  assert.deepEqual(h.queries, [['updateMany', { where: { id: 'owner', displayName: { not: 'ชื่อในเซิร์ฟเวอร์' } }, data: { displayName: 'ชื่อในเซิร์ฟเวอร์' } }]]);
  assert.equal(h.calls.length, 0);
  assert(result.cookie);
  const again = await h.session(cookieValue(result.cookie));
  assert.equal(again.cookie, undefined);
  assert.equal(h.queries.length, 1);
  assert.equal(h.calls.length, 0);
});

test('Gallery reads the synced server name for all of an owner\'s regular characters and keeps special creators hidden', async () => {
  const h = harness();
  await h.session(seal(storedSession()));
  const frames = load('../lib/community-frames.ts', {});
  const characterPolicy = load('../lib/community-policy.ts', {});
  const records = ['Character', 'Human', 'President'].map((characterType, index) => ({
    id: 'character-' + index, name: 'Character ' + index, ownerId: h.user.id, owner: h.user,
    characterType, publicationState: 'PUBLISHED', assets: [], rank: 5,
    race: characterType === 'Human' ? 'Human' : 'Pure blood', arcana: 'STAR', imageLayout: {},
  }));
  let reads = 0;
  const gallery = load('../lib/community-gallery.ts', {
    '@/lib/db': { prisma: { communityCharacter: { findMany: async () => { reads++; return records; } } } },
    '@/lib/community-asset-urls': assetUrls, '@/lib/community-frames': frames, '@/lib/community-policy': characterPolicy,
  });
  const cards = await gallery.listCommunityGallery('viewer');
  assert.deepEqual(Array.from(cards, card => card.owner), ['ชื่อในเซิร์ฟเวอร์', 'ชื่อในเซิร์ฟเวอร์', '']);
  assert.equal(reads, 1);
  assert.equal(h.calls.length, 0, 'Rendering other owners must not fetch Discord per card');
  assert.equal(h.queries.length, 1);
});

test('membership refresh updates renamed owners, and removing the nickname restores the global fallback', async () => {
  const h = harness();
  const cookie = await h.login();
  h.control.nickname = 'ชื่อใหม่ในเซิร์ฟเวอร์';
  const renamed = await h.session(cookie, true);
  assert.equal(renamed.session.name, h.control.nickname);
  assert.equal(h.user.displayName, h.control.nickname);
  h.control.nickname = null;
  const removed = await h.session(cookieValue(renamed.cookie), true);
  assert.equal(removed.session.name, 'Global display');
  assert.equal(h.user.displayName, 'Global display');
  assert.equal(h.user.username, 'discord.account');
  assert.equal(h.calls.length, 5);
});

test('unchanged membership refresh preserves the five-minute cache without extra name writes', async () => {
  const h = harness();
  const cookie = await h.login();
  const expiredCheck = seal({ ...open(cookie), checkedAt: Date.now() - 300_001 });
  const refreshed = await h.session(expiredCheck);
  assert.equal(h.calls.length, 4);
  assert.equal(h.queries.length, 1);
  assert(refreshed.cookie);
  await h.session(cookieValue(refreshed.cookie));
  assert.equal(h.calls.length, 4);
  assert.equal(h.queries.length, 1);
});

test('Discord rate limits retain the verified name and roles, while rejected membership clears the session', async () => {
  const h = harness({ roles: ['staff-role'] });
  const cookie = await h.login();
  h.control.membershipStatus = 429;
  const retained = await h.session(cookie, true);
  assert.equal(retained.session.name, 'ชื่อในเซิร์ฟเวอร์');
  assert.equal(retained.session.isStaff, true);
  assert.equal(h.queries.length, 1);
  for (const status of [401, 403, 404]) {
    h.control.membershipStatus = status;
    const denied = await h.session(cookie, true);
    assert.equal(denied.session, null);
    assert.match(denied.cookie, /Max-Age=0/);
    assert.equal(h.queries.length, 1);
  }
});

test('failed name persistence does not log out a valid user and retries on a later visit', async () => {
  const h = harness({ databaseFailure: true });
  const legacy = seal(storedSession());
  const first = await h.session(legacy);
  assert.equal(first.session.name, 'ชื่อในเซิร์ฟเวอร์');
  assert.equal(first.cookie, undefined);
  assert.equal(h.user.displayName, 'Global display');
  assert.equal(h.warnings.length, 1);
  h.control.databaseFailure = false;
  const recovered = await h.session(legacy);
  assert(recovered.cookie);
  assert.equal(h.user.displayName, 'ชื่อในเซิร์ฟเวอร์');
});

test('unverified legacy member profiles do not overwrite stored owner names on a Discord outage', async () => {
  const h = harness({ membershipStatus: 503 });
  h.user.displayName = 'Previously verified server name';
  const legacy = storedSession();
  delete legacy.guildNickname;
  delete legacy.roles;
  const result = await h.session(seal(legacy));
  assert(result.session);
  assert.equal(result.session.isStaff, false);
  assert.equal(h.queries.length, 0);
  assert.equal(h.user.displayName, 'Previously verified server name');
});

test('invalid, expired, or tampered session cookies cannot change an owner name', async () => {
  const h = harness();
  const valid = seal(storedSession());
  const parts = valid.split('.');
  const bytes = Buffer.from(parts[2], 'base64url');
  bytes[0] ^= 1;
  parts[2] = bytes.toString('base64url');
  for (const value of ['invalid-cookie', parts.join('.'), seal(storedSession({ expiresAt: Date.now() - 1 })), seal(storedSession({ syncedDisplayName: 123 }))]) {
    assert.equal((await h.session(value)).session, null);
  }
  assert.equal(h.calls.length, 0);
  assert.equal(h.queries.length, 0);
});

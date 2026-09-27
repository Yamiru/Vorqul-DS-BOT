import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeZip } from './helpers/makeZip';

vi.mock('../src/dashboard/lib/auth', () => ({ getAppSession: vi.fn() }));
vi.mock('../src/dashboard/lib/audit', () => ({ logAudit: vi.fn() }));

import { getAppSession } from '../src/dashboard/lib/auth';
import { logAudit } from '../src/dashboard/lib/audit';
import { GET, POST } from '../src/dashboard/app/api/guilds/[guildId]/plugins/route';
import { PATCH, DELETE } from '../src/dashboard/app/api/guilds/[guildId]/plugins/[name]/route';

const mockedSession = vi.mocked(getAppSession);
const mockedAudit = vi.mocked(logAudit);

const MANAGE_GUILD = '32';
const manifest = JSON.stringify({
  name: 'demo_plugin',
  version: '1.0.0',
  author: 'Test',
  description: 'A demo',
  main: 'index.js',
  settings: [{ key: 'count', type: 'number', label: 'Count', default: 5, min: 1, max: 10 }]
});
const goodZip = () =>
  makeZip([
    { name: 'manifest.json', data: manifest },
    { name: 'index.js', data: 'export default {};' }
  ]);

let root: string;
let plugins: string;
let tokenCounter = 0;

function signIn(userId: string, permissions = MANAGE_GUILD) {
  const accessToken = `token-${++tokenCounter}`;
  mockedSession.mockResolvedValue({ accessToken, user: { id: userId, email: `${userId}@example.com` } } as never);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([{ id: 'G1', owner: false, permissions }]), { status: 200 }))
  );
}

const headers = (extra: Record<string, string> = {}) => ({ host: 'bot.example.com', origin: 'https://bot.example.com', ...extra });
const ctx = (): { params: Promise<{ guildId: string }> } => ({ params: Promise.resolve({ guildId: 'G1' }) });
const nameCtx = (name: string) => ({ params: Promise.resolve({ guildId: 'G1', name }) });
const url = (suffix = '') => `https://bot.example.com/api/guilds/G1/plugins${suffix}`;

function uploadRequest(zip: Buffer, extraHeaders: Record<string, string> = {}, replace = false) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(zip)], 'plugin.zip', { type: 'application/zip' }));
  form.append('replace', replace ? 'true' : 'false');
  return new NextRequest(url(), { method: 'POST', body: form, headers: headers(extraHeaders) });
}

const json = (body: unknown) => JSON.stringify(body);
const patch = (name: string, body: unknown, extra: Record<string, string> = {}) =>
  PATCH(
    new NextRequest(url(`/${name}`), { method: 'PATCH', body: json(body), headers: headers({ 'content-type': 'application/json', ...extra }) }),
    nameCtx(name)
  );
const remove = (name: string) => DELETE(new NextRequest(url(`/${name}`), { method: 'DELETE', headers: headers() }), nameCtx(name));

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vorqul-routes-'));
  plugins = path.join(root, 'plugins');
  fs.mkdirSync(plugins);
  process.env.PLUGINS_PATH = plugins;
  process.env.DATA_PATH = path.join(root, 'data');
  process.env.BOT_OWNER_ID = 'owner-1, owner-2';
  mockedSession.mockReset();
  mockedAudit.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PLUGINS_PATH;
  delete process.env.DATA_PATH;
  delete process.env.BOT_OWNER_ID;
  fs.rmSync(root, { recursive: true, force: true });
});

const installAsOwner = async () => {
  signIn('owner-1');
  const res = await POST(uploadRequest(goodZip()), ctx());
  expect(res.status).toBe(200);
};

describe('GET /plugins', () => {
  it('lets a server manager see plugins but not manage them', async () => {
    await installAsOwner();
    signIn('someone');
    const res = await GET(new NextRequest(url(), { headers: headers() }), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.canManage).toBe(false);
    expect(body.ownerConfigured).toBe(true);
    expect(body.plugins.map((p: { name: string }) => p.name)).toEqual(['demo_plugin']);
  });

  it('marks the bot owner as able to manage, including a second owner in the list', async () => {
    signIn('owner-2');
    const body = await (await GET(new NextRequest(url(), { headers: headers() }), ctx())).json();
    expect(body.canManage).toBe(true);
  });

  it('reports that no owner is configured and lets nobody manage', async () => {
    delete process.env.BOT_OWNER_ID;
    signIn('owner-1');
    const body = await (await GET(new NextRequest(url(), { headers: headers() }), ctx())).json();
    expect(body).toMatchObject({ canManage: false, ownerConfigured: false });
    expect((await POST(uploadRequest(goodZip()), ctx())).status).toBe(403);
  });

  it('rejects signed-out users and people who do not manage the server', async () => {
    mockedSession.mockResolvedValue(null as never);
    expect((await GET(new NextRequest(url(), { headers: headers() }), ctx())).status).toBe(401);
    signIn('someone', '0');
    expect((await GET(new NextRequest(url(), { headers: headers() }), ctx())).status).toBe(403);
  });
});

describe('owner-only actions', () => {
  it('blocks a normal server manager from installing, changing or removing', async () => {
    await installAsOwner();
    signIn('someone');

    const upload = await POST(uploadRequest(makeZip([{ name: 'manifest.json', data: manifest.replace('demo_plugin', 'other') }, { name: 'index.js', data: 'x' }])), ctx());
    expect(upload.status).toBe(403);
    expect((await upload.json()).error).toBe('not_owner');
    expect(fs.existsSync(path.join(plugins, 'other'))).toBe(false);

    expect((await patch('demo_plugin', { enabled: true })).status).toBe(403);
    expect((await patch('demo_plugin', { settings: { count: 9 } })).status).toBe(403);
    expect((await remove('demo_plugin')).status).toBe(403);
    expect(fs.existsSync(path.join(plugins, 'demo_plugin'))).toBe(true);
  });

  it('blocks cross-site requests even from the owner', async () => {
    signIn('owner-1');
    const res = await POST(uploadRequest(goodZip(), { origin: 'https://evil.example.com' }), ctx());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('cross_origin');
    expect((await patch('demo_plugin', { enabled: true }, { origin: 'https://evil.example.com' })).status).toBe(403);
  });
});

describe('managing plugins as the owner', () => {
  it('installs disabled, enables, saves settings and uninstalls', async () => {
    signIn('owner-1');
    const installed = await POST(uploadRequest(goodZip()), ctx());
    expect(await installed.json()).toMatchObject({ ok: true, name: 'demo_plugin', enabled: false, replaced: false });

    const enable = await patch('demo_plugin', { enabled: true });
    expect(enable.status).toBe(200);
    expect(JSON.parse(fs.readFileSync(path.join(plugins, 'demo_plugin', 'manifest.json'), 'utf-8')).enabled).toBe(true);

    const saved = await patch('demo_plugin', { settings: { count: 7 } });
    expect(saved.status).toBe(200);
    const list = await (await GET(new NextRequest(url(), { headers: headers() }), ctx())).json();
    expect(list.plugins[0].settings.values).toEqual({ count: 7 });
    expect(list.plugins[0].state).toBe('unknown');

    const gone = await remove('demo_plugin');
    expect(gone.status).toBe(200);
    expect(fs.existsSync(path.join(plugins, 'demo_plugin'))).toBe(false);
  });

  it('reports validation problems with useful codes', async () => {
    signIn('owner-1');
    await POST(uploadRequest(goodZip()), ctx());

    const duplicate = await POST(uploadRequest(goodZip()), ctx());
    expect(duplicate.status).toBe(409);
    expect((await duplicate.json()).error).toBe('exists');
    expect((await POST(uploadRequest(goodZip(), {}, true), ctx())).status).toBe(200);

    const notZip = await POST(uploadRequest(Buffer.from('definitely not a zip file')), ctx());
    expect(notZip.status).toBe(400);
    expect((await notZip.json()).error).toBe('not_zip');

    const noFile = await POST(new NextRequest(url(), { method: 'POST', body: new FormData(), headers: headers() }), ctx());
    expect(noFile.status).toBe(400);
    expect((await noFile.json()).error).toBe('no_file');

    const bad = await patch('demo_plugin', { settings: { count: 99 } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'invalid_settings', fields: { count: 'range' } });

    expect((await patch('demo_plugin', 'not an object')).status).toBe(400);
    expect((await patch('missing_plugin', { enabled: true })).status).toBe(404);
    expect((await remove('missing_plugin')).status).toBe(404);
  });

  it('cannot be tricked into touching anything outside the plugins folder', async () => {
    signIn('owner-1');
    fs.writeFileSync(path.join(root, 'keep.txt'), 'keep');
    for (const name of ['..', '..%2Fdata', '%2E%2E', 'a%2Fb']) {
      expect((await remove(name)).status).toBe(404);
      expect((await patch(name, { enabled: true })).status).toBe(404);
    }
    expect(fs.existsSync(path.join(root, 'keep.txt'))).toBe(true);
    expect(fs.existsSync(plugins)).toBe(true);
  });

  it('writes audit entries for the changes it makes', async () => {
    await installAsOwner();
    await patch('demo_plugin', { enabled: true });
    await patch('demo_plugin', { settings: { count: 3 } });
    await remove('demo_plugin');
    expect(mockedAudit.mock.calls.map((call) => call[2])).toEqual([
      'plugin_install',
      'plugin_enable',
      'plugin_settings',
      'plugin_remove'
    ]);
    expect(mockedAudit.mock.calls.every((call) => call[0] === 'G1' && call[1] === 'owner-1@example.com')).toBe(true);
  });
});

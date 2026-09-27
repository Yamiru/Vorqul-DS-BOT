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
import { installPluginZip, listPlugins } from '../src/dashboard/lib/plugins';
import { GET } from '../src/dashboard/app/api/guilds/[guildId]/plugins/route';
import { PUT } from '../src/dashboard/app/api/guilds/[guildId]/plugins/[name]/guild/route';

const mockedSession = vi.mocked(getAppSession);
const mockedAudit = vi.mocked(logAudit);

const TEXT = '111111111111111111';
const TEXT_TWO = '111111111111111112';
const VOICE = '222222222222222222';
const FOREIGN = '333333333333333333';

const manifest = JSON.stringify({
  name: 'guild_plugin',
  version: '1.0.0',
  main: 'index.js',
  settings: [
    { key: 'limit', type: 'number', label: 'Limit', default: 2, min: 1, max: 10 },
    { key: 'minEvery', type: 'number', label: 'Min', default: 5, min: 1, max: 60 }
  ],
  guildSettings: [
    {
      key: 'servers',
      type: 'list',
      label: 'Servers',
      maxItemsFrom: 'limit',
      itemTitleKey: 'name',
      fields: [
        { key: 'name', type: 'string', label: 'Name', default: '', required: true, maxLength: 20 },
        { key: 'channel', type: 'channel', label: 'Channel', required: true },
        { key: 'voice', type: 'channel', label: 'Voice', kinds: ['voice'] },
        { key: 'every', type: 'number', label: 'Every', default: 10, min: 1, max: 1440, minFrom: 'minEvery' }
      ]
    }
  ]
});

let root: string;
let plugins: string;
let counter = 0;

function signIn(permissions = '32') {
  const accessToken = `token-${++counter}`;
  mockedSession.mockResolvedValue({ accessToken, user: { id: 'someone', email: 'someone@example.com' } } as never);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (String(input).includes('/users/@me/guilds')) {
        return new Response(JSON.stringify([{ id: 'G1', owner: false, permissions }, { id: 'G2', owner: false, permissions }]), { status: 200 });
      }
      if (String(input).includes('/guilds/G1/channels')) {
        return new Response(JSON.stringify([{ id: TEXT, type: 0 }, { id: TEXT_TWO, type: 5 }, { id: VOICE, type: 2 }]), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    })
  );
}

const headers = () => ({ host: 'bot.example.com', origin: 'https://bot.example.com', 'content-type': 'application/json' });
const put = (guildId: string, name: string, body: unknown, extra: Record<string, string> = {}) =>
  PUT(
    new NextRequest(`https://bot.example.com/api/guilds/${guildId}/plugins/${name}/guild`, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers: { ...headers(), ...extra }
    }),
    { params: Promise.resolve({ guildId, name }) }
  );
const list = async (guildId: string) =>
  (
    await GET(new NextRequest(`https://bot.example.com/api/guilds/${guildId}/plugins`, { headers: headers() }), {
      params: Promise.resolve({ guildId })
    })
  ).json();

const server = (over: Record<string, unknown> = {}) => ({ name: 'Survival', channel: TEXT, every: 10, ...over });
const guildFile = (guildId: string) => path.join(plugins, 'guild_plugin', 'data', 'guilds', `${guildId}.json`);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vorqul-guild-'));
  plugins = path.join(root, 'plugins');
  fs.mkdirSync(plugins);
  process.env.PLUGINS_PATH = plugins;
  process.env.DATA_PATH = path.join(root, 'data');
  process.env.DISCORD_TOKEN = 'bot-token';
  mockedSession.mockReset();
  mockedAudit.mockClear();
  installPluginZip(makeZip([{ name: 'manifest.json', data: manifest }, { name: 'index.js', data: 'export default {};' }]));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PLUGINS_PATH;
  delete process.env.DATA_PATH;
  delete process.env.DISCORD_TOKEN;
  fs.rmSync(root, { recursive: true, force: true });
});

describe('PUT /plugins/[name]/guild', () => {
  it('lets a server manager save this server\'s settings and returns them with ids', async () => {
    signIn();
    const res = await put('G1', 'guild_plugin', { values: { servers: [server(), server({ name: 'Creative', channel: TEXT_TWO, voice: VOICE })] } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.values.servers).toHaveLength(2);
    expect(body.values.servers[0]).toMatchObject({ name: 'Survival', channel: TEXT, voice: '', every: 10 });
    expect(body.values.servers[1]).toMatchObject({ name: 'Creative', voice: VOICE });
    expect(body.values.servers[0].id).toMatch(/^[a-z0-9]{6,24}$/);

    const stored = JSON.parse(fs.readFileSync(guildFile('G1'), 'utf-8'));
    expect(stored).toEqual(body.values);
    expect(mockedAudit).toHaveBeenCalledWith('G1', 'someone@example.com', 'plugin_guild_settings', expect.stringContaining('guild_plugin'));
  });

  it('shows the saved settings for that server only', async () => {
    signIn();
    await put('G1', 'guild_plugin', { values: { servers: [server()] } });
    const first = await list('G1');
    expect(first.plugins[0].guildSettings.values.servers).toHaveLength(1);
    expect(first.plugins[0].guildSettings.fields[0].key).toBe('servers');
    const other = await list('G2');
    expect(other.plugins[0].guildSettings.values.servers).toEqual([]);
    expect(fs.existsSync(guildFile('G2'))).toBe(false);
  });

  it('keeps ids stable across edits so the plugin can keep its state', async () => {
    signIn();
    const saved = await (await put('G1', 'guild_plugin', { values: { servers: [server()] } })).json();
    const id = saved.values.servers[0].id;
    const edited = await (await put('G1', 'guild_plugin', { values: { servers: [{ ...saved.values.servers[0], name: 'Renamed', every: 30 }] } })).json();
    expect(edited.values.servers[0]).toMatchObject({ id, name: 'Renamed', every: 30 });
  });

  it('rejects channels that are not on this server or of the wrong kind', async () => {
    signIn();
    const foreign = await put('G1', 'guild_plugin', { values: { servers: [server({ channel: FOREIGN })] } });
    expect(foreign.status).toBe(400);
    expect(await foreign.json()).toEqual({ error: 'invalid_settings', fields: { 'servers[0].channel': 'channel_not_found' } });

    const wrongKind = await put('G1', 'guild_plugin', { values: { servers: [server({ voice: TEXT })] } });
    expect((await wrongKind.json()).fields).toEqual({ 'servers[0].voice': 'channel_kind' });
    expect(fs.existsSync(guildFile('G1'))).toBe(false);
  });

  it('reports field errors by path', async () => {
    signIn();
    fs.mkdirSync(path.join(plugins, 'guild_plugin', 'data'), { recursive: true });
    fs.writeFileSync(path.join(plugins, 'guild_plugin', 'data', 'settings.json'), JSON.stringify({ limit: 5 }));
    const res = await put('G1', 'guild_plugin', { values: { servers: [server({ name: '' }), server({ channel: 'abc' }), server({ every: 2 })] } });
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toEqual({
      'servers[0].name': 'required',
      'servers[1].channel': 'channel',
      'servers[2].every': 'range'
    });
  });

  it('enforces the item limit set by the bot owner in the plugin settings', async () => {
    signIn();
    const three = [server({ name: 'A' }), server({ name: 'B' }), server({ name: 'C' })];
    expect((await (await put('G1', 'guild_plugin', { values: { servers: three } })).json()).fields).toEqual({ servers: 'too_many' });

    fs.mkdirSync(path.join(plugins, 'guild_plugin', 'data'), { recursive: true });
    fs.writeFileSync(path.join(plugins, 'guild_plugin', 'data', 'settings.json'), JSON.stringify({ limit: 3 }));
    expect((await put('G1', 'guild_plugin', { values: { servers: three } })).status).toBe(200);
  });

  it('checks channels only when there are any and fails safely without a bot token', async () => {
    signIn();
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_BOT_TOKEN;
    const withChannel = await put('G1', 'guild_plugin', { values: { servers: [server()] } });
    expect(withChannel.status).toBe(503);
    expect((await withChannel.json()).error).toBe('channels_unavailable');
    expect((await put('G1', 'guild_plugin', { values: { servers: [] } })).status).toBe(200);
  });

  it('requires a signed-in server manager and a same-origin request', async () => {
    mockedSession.mockResolvedValue(null as never);
    expect((await put('G1', 'guild_plugin', { values: { servers: [] } })).status).toBe(401);

    signIn('0');
    expect((await put('G1', 'guild_plugin', { values: { servers: [] } })).status).toBe(403);

    signIn();
    const cross = await put('G1', 'guild_plugin', { values: { servers: [] } }, { origin: 'https://evil.example.com' });
    expect(cross.status).toBe(403);
    expect((await cross.json()).error).toBe('cross_origin');
    expect(fs.existsSync(guildFile('G1'))).toBe(false);
  });

  it('cannot save settings for a server the user does not manage', async () => {
    signIn();
    expect((await put('G3', 'guild_plugin', { values: { servers: [] } })).status).toBe(403);
    expect(fs.existsSync(guildFile('G3'))).toBe(false);
  });

  it('handles bad requests, unknown plugins and plugins without server settings', async () => {
    signIn();
    expect((await put('G1', 'guild_plugin', { nope: true })).status).toBe(400);
    expect((await put('G1', 'guild_plugin', { values: null })).status).toBe(400);
    expect((await put('G1', 'missing_plugin', { values: {} })).status).toBe(404);
    expect((await put('G1', '..', { values: {} })).status).toBe(404);

    installPluginZip(makeZip([{ name: 'manifest.json', data: JSON.stringify({ name: 'plain', main: 'index.js' }) }, { name: 'index.js', data: 'x' }]));
    const plain = await put('G1', 'plain', { values: {} });
    expect(plain.status).toBe(400);
    expect((await plain.json()).error).toBe('no_settings');
  });

  it('is visible to managers regardless of the bot owner setting', async () => {
    signIn();
    const info = listPlugins('G1').plugins[0];
    expect(info.guildSettings.fields).toHaveLength(1);
    expect((await list('G1')).canManage).toBe(false);
  });
});

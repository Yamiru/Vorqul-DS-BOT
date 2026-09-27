import fs from 'fs';
import net from 'node:net';
import os from 'os';
import path from 'path';
import { Events } from 'discord.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const ROOT = path.resolve(__dirname, '..');
const CHANNEL = '111111111111111111';
const VOICE = '222222222222222222';

let work: string;
let plugins: string;
let dataDir: string;

function writeVarInt(value: number): Buffer {
  const out: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v) byte |= 0x80;
    out.push(byte);
  } while (v);
  return Buffer.from(out);
}

function fakeMinecraft(state: { online: number; alive: boolean }) {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    if (!state.alive) {
      socket.destroy();
      return;
    }
    socket.on('data', () => {
      const json = Buffer.from(JSON.stringify({ version: { name: 'Paper 1.21' }, players: { online: state.online, max: 50, sample: [{ name: 'Alex' }] }, description: 'Survival hub' }));
      const body = Buffer.concat([writeVarInt(0), writeVarInt(json.length), json]);
      socket.write(Buffer.concat([writeVarInt(body.length), body]));
    });
  });
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () =>
      resolve({
        port: (server.address() as net.AddressInfo).port,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
            for (const socket of sockets) socket.destroy();
          })
      })
    );
  });
}

function fakeDiscord() {
  const handlers = new Map<string, ((...args: unknown[]) => unknown)[]>();
  const messages = new Map<string, { id: string; last: any; edit: (x: any) => Promise<void> }>();
  const log: string[] = [];
  const textChannel = {
    id: CHANNEL,
    isTextBased: () => true,
    isThread: () => false,
    permissionsFor: () => ({ has: () => true }),
    messages: {
      fetch: async (id: string) => {
        const message = messages.get(id);
        if (!message) throw Object.assign(new Error('Unknown Message'), { code: 10008 });
        return message;
      }
    },
    send: async (payload: any) => {
      const message = {
        id: String(messages.size + 1),
        last: payload,
        edit: async (next: any) => {
          message.last = next;
          log.push(`edit:${next.embeds?.[0]?.data?.title}`);
        }
      };
      messages.set(message.id, message);
      log.push(`send:${payload.embeds?.[0]?.data?.title ?? payload.content}`);
      return message;
    }
  };
  const voiceChannel = { id: VOICE, setName: async (name: string) => void log.push(`rename:${name}`) };
  const client: any = {
    commands: new Map(),
    plugins: new Map(),
    isReady: () => true,
    channels: { fetch: async (id: string) => (id === CHANNEL ? textChannel : id === VOICE ? voiceChannel : null) },
    on: (name: string, handler: (...args: unknown[]) => unknown) => void handlers.set(name, [...(handlers.get(name) ?? []), handler]),
    once: (name: string, handler: (...args: unknown[]) => unknown) => void handlers.set(name, [...(handlers.get(name) ?? []), handler]),
    off: (name: string, handler: unknown) => void handlers.set(name, (handlers.get(name) ?? []).filter((h) => h !== handler))
  };
  return { client, handlers, messages, log };
}

function interaction(sub: string, options: Record<string, unknown>, opts: { manage?: boolean } = {}) {
  const replies: any[] = [];
  const value = {
    replies,
    inGuild: () => true,
    guildId: 'G1',
    locale: 'en-US',
    memberPermissions: { has: () => opts.manage !== false },
    guild: { members: { me: {} } },
    options: {
      getSubcommand: () => sub,
      getString: (n: string) => (options[n] as string) ?? null,
      getInteger: (n: string) => (options[n] as number) ?? null,
      getBoolean: (n: string) => (options[n] as boolean) ?? null,
      getChannel: (n: string) => options[n] ?? null,
      getFocused: () => ''
    },
    deferReply: async () => undefined,
    reply: async (x: any) => void replies.push(x),
    editReply: async (x: any) => void replies.push(x)
  };
  return value;
}

const text = (i: ReturnType<typeof interaction>) => i.replies.at(-1)?.content ?? '';

async function boot(pluginName = 'minecraft_status') {
  vi.resetModules();
  process.env.PLUGINS_PATH = plugins;
  process.env.DATA_PATH = dataDir;
  const loader: any = await import('../src/bot/modules/pluginLoader');
  const discord = fakeDiscord();
  await loader.loadPlugins(discord.client);
  return { loader, ...discord, command: discord.client.commands.get('minecraft'), pluginName };
}

function installMinecraft() {
  fs.cpSync(path.join(ROOT, 'plugins', 'minecraft_status'), path.join(plugins, 'minecraft_status'), {
    recursive: true,
    filter: (source) => !source.split(path.sep).includes('data')
  });
}

const pluginData = (...parts: string[]) => path.join(plugins, 'minecraft_status', 'data', ...parts);

const ready = async (handlers: Map<string, ((...args: unknown[]) => unknown)[]>) => {
  await handlers.get(Events.ClientReady)![0]();
  await vi.waitFor(() => expect(fs.existsSync(pluginData('state.json'))).toBe(true));
};
const readJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf-8'));
const writeSettings = (value: unknown) => {
  fs.mkdirSync(pluginData(), { recursive: true });
  fs.writeFileSync(pluginData('settings.json'), JSON.stringify(value));
};
const writeGuild = (guildId: string, value: unknown) => {
  fs.mkdirSync(pluginData('guilds'), { recursive: true });
  fs.writeFileSync(pluginData('guilds', `${guildId}.json`), JSON.stringify(value));
};

beforeEach(() => {
  work = fs.mkdtempSync(path.join(ROOT, '.tmp-plugin-tests-'));
  plugins = path.join(work, 'plugins');
  dataDir = path.join(os.tmpdir(), `vorqul-loader-data-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(plugins);
});

afterEach(() => {
  delete process.env.PLUGINS_PATH;
  delete process.env.DATA_PATH;
  fs.rmSync(work, { recursive: true, force: true });
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('plugin loader: status file and per-server settings', () => {
  const write = (name: string, manifest: object, source = 'export default { name: "x" };') => {
    fs.mkdirSync(path.join(plugins, name), { recursive: true });
    fs.writeFileSync(path.join(plugins, name, 'manifest.json'), JSON.stringify(manifest));
    fs.writeFileSync(path.join(plugins, name, 'index.js'), source);
  };

  it('records loaded, disabled and failed plugins for the dashboard', async () => {
    write('good_one', { name: 'good_one', version: '2.0.0', main: 'index.js' });
    write('off_one', { name: 'off_one', main: 'index.js', enabled: false });
    write('bad_json', { name: 'bad_json', main: 'index.js' }, 'export default { name: "x", onLoad() { throw new Error("boom"); } };');
    write('wrong_name', { name: 'other_name', main: 'index.js' });
    fs.mkdirSync(path.join(plugins, 'no_manifest'));
    fs.mkdirSync(path.join(plugins, '.installing-abc'));

    await boot();
    const status = readJson(path.join(dataDir, 'plugins_status.json'));
    expect(status.plugins.good_one).toMatchObject({ state: 'loaded', version: '2.0.0' });
    expect(status.plugins.off_one.state).toBe('disabled');
    expect(status.plugins.bad_json).toMatchObject({ state: 'error', error: 'boom' });
    expect(status.plugins.wrong_name.state).toBe('error');
    expect(status.plugins.wrong_name.error).toContain('folder name');
    expect(status.plugins.no_manifest.state).toBe('error');
    expect(Object.keys(status.plugins)).not.toContain('.installing-abc');
  });

  it('gives plugins live global and per-server settings that respect the manifest', async () => {
    write(
      'probe',
      {
        name: 'probe',
        main: 'index.js',
        settings: [{ key: 'limit', type: 'number', label: 'Limit', default: 2, min: 1, max: 5 }],
        guildSettings: [
          {
            key: 'items',
            type: 'list',
            label: 'Items',
            maxItemsFrom: 'limit',
            fields: [{ key: 'name', type: 'string', label: 'Name', default: '', required: true }]
          }
        ]
      },
      'export default { name: "probe", onLoad(c) { globalThis.__probe = c; } };'
    );
    await boot();
    const ctx = (globalThis as any).__probe;

    expect(ctx.getSettings()).toEqual({ limit: 2 });
    expect(ctx.getGuildSettings('G1')).toEqual({ items: [] });
    expect(ctx.listGuildSettings()).toEqual({});

    const saved = ctx.saveGuildSettings('G1', { items: [{ name: 'A' }, { name: 'B' }] });
    expect(saved.items).toHaveLength(2);
    expect(saved.items[0].id).toMatch(/^[a-z0-9]{6,24}$/);
    expect(Object.keys(ctx.listGuildSettings())).toEqual(['G1']);
    expect(ctx.getGuildSettings('G1').items.map((i: any) => i.name)).toEqual(['A', 'B']);

    expect(() => ctx.saveGuildSettings('G1', { items: [{ name: '' }] })).toThrow(/Invalid guild settings/);
    expect(() => ctx.saveGuildSettings('G1', { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] })).toThrow(/too_many/);
    expect(() => ctx.saveGuildSettings('../evil', { items: [] })).toThrow(/Invalid guild id/);
    expect(ctx.getGuildSettings('G1').items).toHaveLength(2);

    fs.writeFileSync(path.join(plugins, 'probe', 'data', 'settings.json'), JSON.stringify({ limit: 4 }));
    expect(ctx.getSettings()).toEqual({ limit: 4 });
    expect(ctx.saveGuildSettings('G1', { items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }).items).toHaveLength(3);
    delete (globalThis as any).__probe;
  });
});

describe('plugin loader: enabling and disabling without a restart', () => {
  const writePlugin = (enabled: boolean) => {
    fs.mkdirSync(path.join(plugins, 'toggle_me'), { recursive: true });
    fs.writeFileSync(path.join(plugins, 'toggle_me', 'manifest.json'), JSON.stringify({ name: 'toggle_me', main: 'index.js', enabled }));
    fs.writeFileSync(
      path.join(plugins, 'toggle_me', 'index.js'),
      'export default { name: "toggle_me", commands: [{ data: { name: "toggled" }, execute() {} }] };'
    );
  };
  const status = () => readJson(path.join(dataDir, 'plugins_status.json')).plugins.toggle_me;

  it('loads a plugin that was enabled, unloads it when disabled, and drops it when uninstalled', async () => {
    writePlugin(false);
    const { loader, client } = await boot();
    expect(status().state).toBe('disabled');
    expect(client.commands.has('toggled')).toBe(false);
    expect(await loader.syncPlugins(client)).toBe(false);

    writePlugin(true);
    expect(await loader.syncPlugins(client)).toBe(true);
    expect(client.commands.has('toggled')).toBe(true);
    expect(status().state).toBe('loaded');
    expect(await loader.syncPlugins(client)).toBe(false);

    writePlugin(false);
    expect(await loader.syncPlugins(client)).toBe(true);
    expect(client.commands.has('toggled')).toBe(false);
    expect(status().state).toBe('disabled');

    writePlugin(true);
    await loader.syncPlugins(client);
    expect(client.commands.has('toggled')).toBe(true);

    fs.rmSync(path.join(plugins, 'toggle_me'), { recursive: true, force: true });
    expect(await loader.syncPlugins(client)).toBe(true);
    expect(client.commands.has('toggled')).toBe(false);
    expect(readJson(path.join(dataDir, 'plugins_status.json')).plugins.toggle_me).toBeUndefined();
  });

  it('does not retry a broken plugin until its manifest changes', async () => {
    writePlugin(true);
    fs.writeFileSync(path.join(plugins, 'toggle_me', 'index.js'), 'throw new Error("boom");');
    const { loader, client } = await boot();
    expect(status().state).toBe('error');
    await loader.syncPlugins(client);
    await loader.syncPlugins(client);
    expect(status().state).toBe('error');

    fs.writeFileSync(path.join(plugins, 'toggle_me', 'manifest.json'), JSON.stringify({ name: 'toggle_me', main: 'fixed.js', enabled: true, version: '1.0.1' }));
    fs.writeFileSync(
      path.join(plugins, 'toggle_me', 'fixed.js'),
      'export default { name: "toggle_me", commands: [{ data: { name: "toggled" }, execute() {} }] };'
    );
    const changed = await loader.syncPlugins(client);
    expect(status()).toMatchObject({ state: 'loaded' });
    expect(changed).toBe(true);
  });
});

describe('minecraft_status with the real loader', () => {
  let mc: Awaited<ReturnType<typeof fakeMinecraft>>;
  const state = { online: 3, alive: true };

  beforeEach(async () => {
    state.online = 3;
    state.alive = true;
    mc = await fakeMinecraft(state);
    installMinecraft();
    writeSettings({ allowPrivateHosts: true, minInterval: 2, defaultInterval: 12, maxServersPerGuild: 2 });
  });

  afterEach(async () => {
    await mc.close();
  });

  const tracker = (over: Record<string, unknown> = {}) => ({
    id: 'abcdef123456', name: 'Survival', host: '127.0.0.1', port: mc.port, edition: 'java', channel: CHANNEL, statChannel: VOICE,
    interval: 10, showPlayers: true, notify: true, language: 'en', ...over
  });

  const embedsOf = (i: ReturnType<typeof interaction>) => i.replies.at(-1)?.embeds?.map((e: any) => e.data) ?? [];
  const run = async (command: any, options: Record<string, unknown> = {}) => {
    const i = interaction('', options);
    await command.execute(i);
    return i;
  };

  it('starts posting a server that was added in the dashboard, and /minecraft shows its status and address', async () => {
    writeGuild('G1', { servers: [tracker()] });
    const { handlers, log, messages, command } = await boot();
    expect(command).toBeDefined();

    await ready(handlers);
    expect(log).toEqual(['send:🟢 Survival', 'rename:🟢 3/50 players']);
    const embed = messages.get('1')!.last.embeds[0].data;
    expect(embed.fields.map((f: any) => f.name)).toEqual(['Status', 'Players', 'Version', 'Address', 'Response time', 'Online now']);
    expect(embed.footer.text).toBe('Updates every 10 min • vorqul.com');
    expect(readJson(pluginData('state.json')).abcdef123456).toMatchObject({ messageId: '1', online: true, channelId: CHANNEL });

    log.length = 0;
    state.online = 7;
    const shown = await run(command);
    const [status] = embedsOf(shown);
    expect(status.title).toBe('🟢 Survival');
    expect(status.fields.find((f: any) => f.name === 'Address').value).toBe(`\`127.0.0.1:${mc.port}\``);
    expect(status.fields.find((f: any) => f.name === 'Players').value).toContain('7/50');
    expect(log).toEqual(['edit:🟢 Survival']);
    expect(messages.size).toBe(1);
  });

  it('has no management subcommands: /minecraft takes one optional server option', async () => {
    const { command } = await boot();
    const json = command.data.toJSON();
    expect(json.options.map((o: any) => [o.name, Boolean(o.required)])).toEqual([['server', false]]);
    expect(json.options.some((o: any) => o.type === 1)).toBe(false);
  });

  it('reads edits made in the dashboard (name, address and interval) without a restart', async () => {
    writeGuild('G1', { servers: [tracker()] });
    const { handlers, messages, command } = await boot();
    await ready(handlers);

    writeGuild('G1', { servers: [tracker({ name: 'Renamed', interval: 30, statChannel: '' })] });
    const [status] = embedsOf(await run(command, { server: 'renamed' }));
    expect(status.title).toBe('🟢 Renamed');
    expect(status.footer.text).toContain('30 min');
    expect(messages.size).toBe(1);
  });

  it('applies the minimum interval set by the bot owner', async () => {
    writeSettings({ allowPrivateHosts: true, minInterval: 20, defaultInterval: 12, maxServersPerGuild: 1 });
    writeGuild('G1', { servers: [tracker({ interval: 5 })] });
    const { command } = await boot();
    expect(embedsOf(await run(command))[0].footer.text).toContain('20 min');
  });

  it('shows every server when none is named, and tells when there is none', async () => {
    const { command } = await boot();
    const empty = await run(command);
    expect(text(empty)).toContain('Plugins');
    expect(empty.replies.at(-1).flags).toBeDefined();

    writeGuild('G1', { servers: [tracker(), tracker({ id: 'fedcba654321', name: 'Creative', statChannel: '' })] });
    const both = await run(command);
    expect(embedsOf(both).map((e: any) => e.title)).toEqual(['🟢 Survival', '🟢 Creative']);

    const missing = await run(command, { server: 'nope' });
    expect(text(missing)).toBe('No tracked server called **nope**.');
  });

  it('refuses private addresses unless the owner allows them', async () => {
    writeSettings({ allowPrivateHosts: false });
    writeGuild('G1', { servers: [tracker()] });
    const { command, log } = await boot();
    const [status] = embedsOf(await run(command));
    expect(status.title).toBe('🔴 Survival');
    expect(log).toEqual([]);
  });

  it('announces going offline after two failed checks and coming back', async () => {
    writeGuild('G1', { servers: [tracker({ statChannel: '' })] });
    const { handlers, log, command } = await boot();
    await ready(handlers);
    log.length = 0;

    state.alive = false;
    await command.execute(interaction('', {}));
    expect(log).toEqual(['edit:🔴 Survival']);
    log.length = 0;
    await command.execute(interaction('', {}));
    expect(log).toEqual(['edit:🔴 Survival', 'send:🔴 **Survival** went offline.']);
    log.length = 0;
    state.alive = true;
    await command.execute(interaction('', {}));
    expect(log).toEqual(['edit:🟢 Survival', 'send:🟢 **Survival** is back online - 3/50 players.']);
  });

  it('cleans up when a channel or the whole server is deleted', async () => {
    writeGuild('G1', { servers: [tracker(), tracker({ id: 'fedcba654321', name: 'Other', channel: '333333333333333333' })] });
    const { handlers } = await boot();

    await handlers.get(Events.ChannelDelete)![0]({ id: VOICE });
    let servers = readJson(pluginData('guilds', 'G1.json')).servers;
    expect(servers.map((s: any) => [s.name, s.statChannel])).toEqual([['Survival', ''], ['Other', '']]);

    await handlers.get(Events.ChannelDelete)![0]({ id: CHANNEL });
    servers = readJson(pluginData('guilds', 'G1.json')).servers;
    expect(servers.map((s: any) => s.name)).toEqual(['Other']);

    await handlers.get(Events.GuildDelete)![0]({ id: 'G1' });
    expect(readJson(pluginData('guilds', 'G1.json')).servers).toEqual([]);
  });

  it('migrates servers saved by the first version of the plugin', async () => {
    fs.mkdirSync(pluginData(), { recursive: true });
    fs.writeFileSync(
      pluginData('servers.json'),
      JSON.stringify({
        servers: [
          {
            id: 'legacyid1234', guildId: 'G9', name: 'Old', host: 'play.example.com', port: null, edition: 'java', channelId: CHANNEL,
            statChannelId: VOICE, intervalMin: 15, showPlayers: false, notify: true, lang: 'sk', messageId: '55', online: true, failStreak: 0,
            lastRun: 1, lastRename: 2, lastName: 'x'
          }
        ]
      })
    );
    await boot();
    const migrated = readJson(pluginData('guilds', 'G9.json')).servers;
    expect(migrated).toEqual([
      { id: 'legacyid1234', name: 'Old', host: 'play.example.com', port: null, edition: 'java', channel: CHANNEL, statChannel: VOICE, interval: 15, showPlayers: false, notify: true, language: 'sk' }
    ]);
    expect(readJson(pluginData('state.json')).legacyid1234).toMatchObject({ messageId: '55', channelId: CHANNEL });
    expect(readJson(pluginData('servers.json'))).toMatchObject({ servers: [] });

    vi.resetModules();
    await boot();
    expect(readJson(pluginData('guilds', 'G9.json')).servers).toHaveLength(1);
  });
});

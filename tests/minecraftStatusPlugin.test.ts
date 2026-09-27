import net from 'node:net';
import { describe, expect, it, afterAll } from 'vitest';
import plugin, { _internals } from '../plugins/minecraft_status/index.js';

const { writeVarInt, readVarInt, packet, flattenChat, cleanMotd, isPrivateIp, parseAddress, pingJava, langFromLocale, tr, bar, S, LANGS } =
  _internals;

function closeServer(server: net.Server, sockets: Set<net.Socket>) {
  return new Promise<void>((done) => {
    server.close(() => done());
    for (const socket of sockets) socket.destroy();
  });
}

function fakeMinecraftServer(status: unknown) {
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let received = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      received = Buffer.concat([received, chunk]);
      const first = readVarInt(received, 0);
      if (!first) return;
      const handshakeEnd = first.size + first.value;
      const second = readVarInt(received, handshakeEnd);
      if (!second || received.length < handshakeEnd + second.size + second.value) return;
      const json = Buffer.from(JSON.stringify(status), 'utf8');
      const body = Buffer.concat([writeVarInt(0x00), writeVarInt(json.length), json]);
      socket.write(packet(body));
    });
  });
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      resolve({
        port: address.port,
        close: () => closeServer(server, sockets)
      });
    });
  });
}

describe('minecraft_status: protocol helpers', () => {
  it('round-trips VarInts', () => {
    for (const value of [0, 1, 127, 128, 255, 25565, 765, 2097151]) {
      const encoded = writeVarInt(value);
      expect(readVarInt(encoded, 0)).toEqual({ value, size: encoded.length });
    }
  });

  it('returns null for a truncated VarInt', () => {
    expect(readVarInt(Buffer.from([0x80]), 0)).toBeNull();
  });

  it('flattens chat components and strips colour codes', () => {
    const motd = { text: '§aHello ', extra: [{ text: 'World', extra: [{ text: '!' }] }] };
    expect(flattenChat(motd)).toBe('§aHello World!');
    expect(cleanMotd(motd)).toBe('Hello World!');
    expect(cleanMotd('§6§lPlain§r string')).toBe('Plain string');
  });

  it('flags private and local addresses', () => {
    for (const address of ['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1', '169.254.1.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isPrivateIp(address)).toBe(true);
    }
    for (const address of ['8.8.8.8', '203.0.113.10', '172.32.0.1', '2606:4700:4700::1111']) {
      expect(isPrivateIp(address)).toBe(false);
    }
  });

  it('parses and validates server addresses', () => {
    expect(parseAddress('Play.Example.com', null)).toEqual({ host: 'play.example.com', port: null });
    expect(parseAddress('play.example.com:25566', null)).toEqual({ host: 'play.example.com', port: 25566 });
    expect(parseAddress('minecraft://play.example.com/', null)).toEqual({ host: 'play.example.com', port: null });
    expect(parseAddress('play.example.com', 19132)).toEqual({ host: 'play.example.com', port: 19132 });
    expect(parseAddress('bad host!', null)).toBeNull();
    expect(parseAddress('', null)).toBeNull();
    expect(parseAddress('a.example.com', 70000)).toBeNull();
  });

  it('maps Discord locales to supported languages', () => {
    expect(langFromLocale('sk')).toBe('sk');
    expect(langFromLocale('es-ES')).toBe('es');
    expect(langFromLocale('en-US')).toBe('en');
    expect(langFromLocale('pt-BR')).toBe('en');
    expect(langFromLocale(undefined)).toBe('en');
  });

  it('draws a 10-segment player bar', () => {
    expect(bar(0, 100)).toBe('▱▱▱▱▱▱▱▱▱▱');
    expect(bar(50, 100)).toBe('▰▰▰▰▰▱▱▱▱▱');
    expect(bar(100, 100)).toBe('▰▰▰▰▰▰▰▰▰▰');
    expect(bar(5, 0)).toBe('▱▱▱▱▱▱▱▱▱▱');
  });
});

describe('minecraft_status: translations', () => {
  const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

  it('has every English key in every language with matching placeholders', () => {
    for (const lang of LANGS) {
      for (const [key, value] of Object.entries(S.en as Record<string, string>)) {
        const translated = (S as Record<string, Record<string, string>>)[lang][key];
        expect(translated, `${lang}.${key}`).toBeTruthy();
        expect(placeholders(translated), `${lang}.${key}`).toBe(placeholders(value));
      }
    }
  });

  it('fills variables and falls back to English', () => {
    expect(tr('sk', 'notFound', { name: 'Survival' })).toContain('Survival');
    expect(tr('xx', 'online')).toBe('Online');
  });
});

describe('minecraft_status: pingJava', () => {
  const closers: Array<() => Promise<void>> = [];
  afterAll(async () => {
    for (const close of closers) await close();
  });

  it('reads name, players and version from a server list ping', async () => {
    const fake = await fakeMinecraftServer({
      version: { name: 'Paper 1.21', protocol: 767 },
      players: { max: 100, online: 12, sample: [{ name: 'Alex', id: 'x' }, { name: 'Steve', id: 'y' }] },
      description: { text: '§aWelcome to ', extra: [{ text: 'Vorqul' }] }
    });
    closers.push(fake.close);

    const { json, latency } = await pingJava('127.0.0.1', fake.port, 'play.example.com');
    expect(json.players.online).toBe(12);
    expect(json.players.max).toBe(100);
    expect(json.version.name).toBe('Paper 1.21');
    expect(cleanMotd(json.description)).toBe('Welcome to Vorqul');
    expect(latency).toBeGreaterThanOrEqual(0);
  });

  it('rejects when nothing is listening', async () => {
    const fake = await fakeMinecraftServer({});
    const port = fake.port;
    await fake.close();
    await expect(pingJava('127.0.0.1', port, 'localhost', 1500)).rejects.toBeTruthy();
  });

  it('rejects on a server that never answers', async () => {
    const sockets = new Set<net.Socket>();
    const silent = net.createServer((socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    await new Promise<void>((done) => silent.listen(0, '127.0.0.1', () => done()));
    closers.push(() => closeServer(silent, sockets));
    const port = (silent.address() as net.AddressInfo).port;
    await expect(pingJava('127.0.0.1', port, 'localhost', 400)).rejects.toThrow('timeout');
  });
});

describe('minecraft_status: plugin shape', () => {
  it('exports one /minecraft command with a single optional server option', () => {
    expect(plugin.name).toBe('minecraft_status');
    expect(plugin.commands).toHaveLength(1);
    const json = plugin.commands[0].data.toJSON() as { name: string; description: string; options: any[] };
    expect(json.name).toBe('minecraft');
    expect(json.description.length).toBeLessThanOrEqual(100);
    expect(json.options.map((o: { name: string; required?: boolean }) => [o.name, Boolean(o.required)])).toEqual([['server', false]]);
    expect(json.options[0].description.length).toBeLessThanOrEqual(100);
  });
});

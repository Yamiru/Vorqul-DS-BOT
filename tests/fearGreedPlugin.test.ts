import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import plugin, { _internals } from '../plugins/fear_greed/index.js';
import { resolveGuildSettings, validateManifest } from '../src/shared/pluginManifest';

const { level, buildEmbed, langFromLocale, tr, S, LANGS } = _internals;

afterEach(() => {
  vi.unstubAllGlobals();
});

function fakeContext(guilds: Record<string, unknown>, sent: any[]) {
  const store: Record<string, unknown> = {};
  const channel = { isTextBased: () => true, send: async (payload: any) => void sent.push(payload) };
  return {
    client: { isReady: () => true, channels: { fetch: async () => channel } },
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined },
    readData: (file: string, fallback: unknown) => (file in store ? store[file] : fallback),
    writeData: (file: string, value: unknown) => void (store[file] = value),
    listGuildSettings: () => guilds,
    getGuildSettings: (id: string) => guilds[id],
    store
  };
}

const api = (value: string, classification = 'Greed') =>
  vi.fn(async () => new Response(JSON.stringify({ data: [{ value, value_classification: classification, timestamp: '1700000000' }] }), { status: 200 }));

describe('fear_greed plugin', () => {
  it('has a valid manifest with per-server settings', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugins', 'fear_greed', 'manifest.json'), 'utf-8'));
    const parsed = validateManifest(raw);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.manifest.name).toBe('fear_greed');
    const values = resolveGuildSettings(parsed.manifest.guildSettings, {}, {});
    expect(values).toMatchObject({ enabled: false, channel: '', intervalHours: 24, language: 'en' });
  });

  it('exports a single /feargreed command with no options', () => {
    expect(plugin.commands).toHaveLength(1);
    const json = plugin.commands[0].data.toJSON() as { name: string; options?: unknown[] };
    expect(json.name).toBe('feargreed');
    expect(json.options ?? []).toEqual([]);
  });

  it('maps the value to the five sentiment levels', () => {
    expect([0, 20, 21, 40, 41, 60, 61, 80, 81, 100].map((v) => level(v).key)).toEqual([
      'extremeFear', 'extremeFear', 'fear', 'fear', 'neutral', 'neutral', 'greed', 'greed', 'extremeGreed', 'extremeGreed'
    ]);
  });

  it('has every English string in every language', () => {
    for (const lang of LANGS) {
      for (const key of Object.keys(S.en)) expect((S as any)[lang][key], `${lang}.${key}`).toBeTruthy();
    }
    expect(langFromLocale('sk')).toBe('sk');
    expect(langFromLocale('en-GB')).toBe('en');
    expect(langFromLocale('xx')).toBe('en');
    expect(tr('xx', 'source')).toBe('Source');
  });

  it('builds the embed with the value, gauge and source', () => {
    const embed = buildEmbed({ value: 25, classification: 'Fear', timestamp: 1700000000 }, 'sk').toJSON();
    expect(embed.title).toContain('Crypto Fear & Greed Index');
    expect(embed.fields![0].value).toContain('**25/100**');
    expect(embed.fields![0].value).toContain('█████░░░░░░░░░░░░░░░');
    expect(embed.fields![2].value).toBe(S.sk.fear);
    expect(embed.footer!.text).toBe('Zdroj: Alternative.me • vorqul.com');
  });

  it('answers the command, caches the value and reports failures', async () => {
    const fetchMock = api('61');
    vi.stubGlobal('fetch', fetchMock);
    const sent: any[] = [];
    const ctx = fakeContext({}, sent);
    plugin.onLoad(ctx as never);
    try {
      const replies: any[] = [];
      const interaction = { locale: 'en-US', deferReply: async () => undefined, editReply: async (x: any) => void replies.push(x) };
      await plugin.commands[0].execute(interaction as never);
      await plugin.commands[0].execute(interaction as never);
      expect(replies[0].embeds[0].toJSON().fields[0].value).toContain('**61/100**');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      plugin.onUnload();
    }

    plugin.onLoad(ctx as never);
    try {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
      const replies: any[] = [];
      await plugin.commands[0].execute({ locale: 'sk', deferReply: async () => undefined, editReply: async (x: any) => void replies.push(x) } as never);
      expect(replies[0].content).toBe(S.sk.error);
    } finally {
      plugin.onUnload();
    }
  });

  it('posts on the schedule to enabled servers only, once per interval', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', api('30', 'Fear'));
      const sent: any[] = [];
      const guilds = {
        G1: { enabled: true, channel: '111', intervalHours: 24, language: 'de' },
        G2: { enabled: false, channel: '222', intervalHours: 24, language: 'en' },
        G3: { enabled: true, channel: '', intervalHours: 24, language: 'en' }
      };
      const ctx = fakeContext(guilds, sent);
      plugin.onLoad(ctx as never);

      await vi.advanceTimersByTimeAsync(5 * 60_000 + 10);
      expect(sent).toHaveLength(1);
      expect(sent[0].embeds[0].toJSON().footer.text).toContain('Quelle');
      expect(Object.keys(ctx.store['state.json'] as object)).toEqual(['G1']);

      await vi.advanceTimersByTimeAsync(60 * 60_000);
      expect(sent).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
      expect(sent).toHaveLength(2);
      plugin.onUnload();
    } finally {
      vi.useRealTimers();
    }
  });
});

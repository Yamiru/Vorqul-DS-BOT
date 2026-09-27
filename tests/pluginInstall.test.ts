import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeZip, type ZipFile } from './helpers/makeZip';
import {
  installPluginZip,
  listPlugins,
  removePlugin,
  savePluginSettings,
  setPluginEnabled,
  PluginError
} from '../src/dashboard/lib/plugins';

const manifest = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    name: 'demo_plugin',
    version: '1.0.0',
    author: 'Test',
    description: 'A demo',
    main: 'index.js',
    enabled: true,
    settings: [{ key: 'count', type: 'number', label: 'Count', default: 5, min: 1, max: 10 }],
    ...extra
  });

const goodFiles = (): ZipFile[] => [
  { name: 'manifest.json', data: manifest() },
  { name: 'index.js', data: 'export default { name: "demo_plugin" };' },
  { name: 'lib/util.js', data: 'export const x = 1;' }
];

function code(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof PluginError) return error.code;
    throw error;
  }
  return 'no-error';
}

let root: string;
let plugins: string;
let dataDir: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vorqul-plugins-'));
  plugins = path.join(root, 'plugins');
  dataDir = path.join(root, 'data');
  fs.mkdirSync(plugins);
  process.env.PLUGINS_PATH = plugins;
  process.env.DATA_PATH = dataDir;
});

afterEach(() => {
  delete process.env.PLUGINS_PATH;
  delete process.env.DATA_PATH;
  fs.rmSync(root, { recursive: true, force: true });
});

const hiddenEntries = () => fs.readdirSync(plugins).filter((n) => n.startsWith('.'));

describe('installPluginZip', () => {
  it('installs a plugin disabled, with nested files, and ignores data/ and junk', () => {
    const result = installPluginZip(
      makeZip([
        ...goodFiles(),
        { name: 'data/servers.json', data: '{"x":1}' },
        { name: '__MACOSX/._index.js', data: 'x' },
        { name: '.DS_Store', data: 'x' }
      ])
    );
    expect(result).toMatchObject({ name: 'demo_plugin', version: '1.0.0', replaced: false, enabled: false });

    const dir = path.join(plugins, 'demo_plugin');
    expect(fs.readFileSync(path.join(dir, 'lib', 'util.js'), 'utf-8')).toBe('export const x = 1;');
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8')).enabled).toBe(false);
    expect(fs.existsSync(path.join(dir, 'data'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '__MACOSX'))).toBe(false);
    expect(hiddenEntries()).toEqual([]);
  });

  it('supports stored and deflated entries and a single wrapper folder', () => {
    const wrapped = goodFiles().map((f, i) => ({ ...f, name: `pack/${f.name}`, method: (i % 2 ? 0 : 8) as 0 | 8 }));
    expect(installPluginZip(makeZip(wrapped)).name).toBe('demo_plugin');
    expect(fs.existsSync(path.join(plugins, 'demo_plugin', 'index.js'))).toBe(true);
  });

  it('refuses to overwrite unless replace is set, then keeps data and the enabled state', () => {
    installPluginZip(makeZip(goodFiles()));
    expect(code(() => installPluginZip(makeZip(goodFiles())))).toBe('exists');

    setPluginEnabled('demo_plugin', true);
    fs.mkdirSync(path.join(plugins, 'demo_plugin', 'data'));
    fs.writeFileSync(path.join(plugins, 'demo_plugin', 'data', 'servers.json'), '{"keep":true}');
    fs.writeFileSync(path.join(plugins, 'demo_plugin', 'old.js'), 'old');

    const result = installPluginZip(
      makeZip([
        { name: 'manifest.json', data: manifest({ version: '2.0.0' }) },
        { name: 'index.js', data: 'new' }
      ]),
      { replace: true }
    );
    expect(result).toMatchObject({ replaced: true, version: '2.0.0', enabled: true });
    const dir = path.join(plugins, 'demo_plugin');
    expect(fs.existsSync(path.join(dir, 'old.js'))).toBe(false);
    expect(fs.readFileSync(path.join(dir, 'data', 'servers.json'), 'utf-8')).toBe('{"keep":true}');
    expect(hiddenEntries()).toEqual([]);
  });

  it('rejects path traversal and other unsafe paths', () => {
    for (const name of ['../evil.js', 'a/../../evil.js', '/etc/passwd', 'C:/win.js', 'dir\\evil.js']) {
      expect(code(() => installPluginZip(makeZip([...goodFiles(), { name, data: 'x' }])))).toBe('bad_path');
    }
    expect(fs.readdirSync(plugins)).toEqual([]);
    expect(fs.existsSync(path.join(root, 'evil.js'))).toBe(false);
  });

  it('rejects symlinks, encrypted entries and corrupt data', () => {
    const link = { name: 'link', data: '/etc/passwd', madeBy: 0x031e, attr: (0xa1ff << 16) >>> 0 };
    expect(code(() => installPluginZip(makeZip([...goodFiles(), link])))).toBe('symlink');
    expect(
      code(() =>
        installPluginZip(
          makeZip([
            { name: 'manifest.json', data: manifest(), flags: 1 },
            { name: 'index.js', data: 'x' }
          ])
        )
      )
    ).toBe('encrypted');
    expect(code(() => installPluginZip(makeZip([...goodFiles(), { name: 'bad.js', data: 'abc', badCrc: true }])))).toBe('corrupt');
    expect(code(() => installPluginZip(Buffer.from('this is not a zip file at all')))).toBe('not_zip');
    expect(code(() => installPluginZip(Buffer.alloc(0)))).toBe('too_large');
  });

  it('rejects a decompression bomb whose declared size lies', () => {
    const zip = makeZip([...goodFiles(), { name: 'bomb.bin', data: Buffer.alloc(2_000_000, 0), method: 8 }]);
    const marker = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
    const central = zip.lastIndexOf(marker);
    expect(zip.toString('utf-8', central + 46, central + 46 + 8)).toBe('bomb.bin');
    zip.writeUInt32LE(100, central + 24);
    expect(code(() => installPluginZip(zip))).toBe('corrupt');
  });

  it('enforces size and file-count limits', () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ name: `f${i}.txt`, data: 'x', method: 0 as const }));
    expect(code(() => installPluginZip(makeZip([...goodFiles(), ...many])))).toBe('too_many_files');
    const big = { name: 'big.bin', data: Buffer.alloc(11 * 1024 * 1024, 1) };
    expect(code(() => installPluginZip(makeZip([...goodFiles(), big])))).toBe('file_too_large');
  });

  it('validates the manifest and its main file', () => {
    const only = (data: string, extra: ZipFile[] = [{ name: 'index.js', data: 'x' }]) =>
      makeZip([{ name: 'manifest.json', data }, ...extra]);
    expect(code(() => installPluginZip(makeZip([{ name: 'index.js', data: 'x' }])))).toBe('no_manifest');
    expect(code(() => installPluginZip(only('{not json')))).toBe('bad_manifest');
    expect(code(() => installPluginZip(only(manifest({ name: '../evil' }))))).toBe('bad_manifest');
    expect(code(() => installPluginZip(only(manifest({ main: 'index.ts' }), [{ name: 'index.ts', data: 'x' }])))).toBe('bad_manifest');
    expect(code(() => installPluginZip(only(manifest(), [{ name: 'other.js', data: 'x' }])))).toBe('missing_main');
    expect(
      code(() =>
        installPluginZip(
          makeZip([
            { name: 'a/manifest.json', data: manifest() },
            { name: 'b/manifest.json', data: manifest() },
            { name: 'a/index.js', data: 'x' }
          ])
        )
      )
    ).toBe('no_manifest');
    expect(fs.readdirSync(plugins)).toEqual([]);
  });

  it('reports plugin dependencies', () => {
    const result = installPluginZip(makeZip([...goodFiles(), { name: 'package.json', data: '{"dependencies":{}}' }]));
    expect(result.hasDependencies).toBe(true);
  });
});

describe('listing, enabling, settings and removal', () => {
  const writeStatus = (statuses: Record<string, unknown>) => {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'plugins_status.json'), JSON.stringify({ updatedAt: new Date().toISOString(), plugins: statuses }));
  };
  const stateOf = () => listPlugins().plugins.find((p) => p.name === 'demo_plugin')?.state;

  beforeEach(() => {
    installPluginZip(makeZip(goodFiles()));
  });

  it('derives the state from the manifest and the bot status file', () => {
    expect(listPlugins().botStatusKnown).toBe(false);
    expect(stateOf()).toBe('disabled');

    setPluginEnabled('demo_plugin', true);
    expect(stateOf()).toBe('unknown');

    writeStatus({});
    expect(listPlugins().botStatusKnown).toBe(true);
    expect(stateOf()).toBe('restart_enable');

    writeStatus({ demo_plugin: { state: 'loaded', commands: ['demo'], events: 2 } });
    expect(stateOf()).toBe('running');
    const info = listPlugins().plugins[0];
    expect(info.commands).toEqual(['demo']);
    expect(info.events).toBe(2);

    setPluginEnabled('demo_plugin', false);
    expect(stateOf()).toBe('restart_disable');

    writeStatus({ demo_plugin: { state: 'error', error: 'boom' } });
    expect(stateOf()).toBe('disabled');
    setPluginEnabled('demo_plugin', true);
    expect(stateOf()).toBe('error');
    expect(listPlugins().plugins[0].runtimeError).toBe('boom');
  });

  it('flags invalid manifests without hiding the plugin', () => {
    fs.mkdirSync(path.join(plugins, 'broken'));
    fs.writeFileSync(path.join(plugins, 'broken', 'manifest.json'), '{oops');
    fs.mkdirSync(path.join(plugins, 'mismatch'));
    fs.writeFileSync(path.join(plugins, 'mismatch', 'manifest.json'), manifest());
    fs.mkdirSync(path.join(plugins, '.hidden'));
    const list = listPlugins().plugins;
    expect(list.map((p) => p.folder)).toEqual(['broken', 'demo_plugin', 'mismatch']);
    expect(list.find((p) => p.folder === 'broken')).toMatchObject({ valid: false, state: 'invalid' });
    expect(list.find((p) => p.folder === 'mismatch')).toMatchObject({ valid: false, state: 'invalid' });
  });

  it('saves and validates settings', () => {
    expect(listPlugins().plugins[0].settings.values).toEqual({ count: 5 });
    expect(savePluginSettings('demo_plugin', { count: 8 })).toEqual({ ok: true, values: { count: 8 } });
    expect(listPlugins().plugins[0].settings.values).toEqual({ count: 8 });
    const stored = JSON.parse(fs.readFileSync(path.join(plugins, 'demo_plugin', 'data', 'settings.json'), 'utf-8'));
    expect(stored).toEqual({ count: 8 });

    const bad = savePluginSettings('demo_plugin', { count: 99 });
    expect('errors' in bad && bad.errors).toEqual({ count: 'range' });
    expect(listPlugins().plugins[0].settings.values).toEqual({ count: 8 });
  });

  it('refuses settings for plugins that declare none', () => {
    installPluginZip(
      makeZip([
        { name: 'manifest.json', data: JSON.stringify({ name: 'plain', main: 'index.js' }) },
        { name: 'index.js', data: 'x' }
      ])
    );
    expect(code(() => savePluginSettings('plain', { a: 1 }))).toBe('no_settings');
  });

  it('removes a plugin completely', () => {
    removePlugin('demo_plugin');
    expect(fs.existsSync(path.join(plugins, 'demo_plugin'))).toBe(false);
    expect(listPlugins().plugins).toEqual([]);
  });

  it('rejects unknown names and traversal in every operation', () => {
    fs.writeFileSync(path.join(root, 'outside.txt'), 'keep');
    for (const name of ['../data', '..', 'nope', 'Demo_Plugin', '', 'a/b']) {
      expect(code(() => removePlugin(name))).toBe('not_found');
      expect(code(() => setPluginEnabled(name, true))).toBe('not_found');
      expect(code(() => savePluginSettings(name, {}))).toBe('not_found');
    }
    expect(fs.existsSync(path.join(root, 'outside.txt'))).toBe(true);
    expect(fs.existsSync(path.join(plugins, 'demo_plugin'))).toBe(true);
  });
});

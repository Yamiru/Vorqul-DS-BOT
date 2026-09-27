import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GuildPluginSettings from '../src/dashboard/app/dashboard/[guildId]/settings/GuildPluginSettings';
import { LanguageProvider } from '../src/dashboard/app/components/LanguageProvider';
import { resolveGuildSettings, resolveSettings, validateManifest } from '../src/shared/pluginManifest';

const CHANNEL = '111111111111111111';

function bundledPlugin() {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'plugins', 'minecraft_status', 'manifest.json'), 'utf-8'));
  const parsed = validateManifest(raw);
  if ('error' in parsed) throw new Error(parsed.error);
  return parsed.manifest;
}

function render(stored: unknown, state = 'running') {
  const manifest = bundledPlugin();
  const globals = resolveSettings(manifest.settings, { maxServersPerGuild: 3 });
  return renderToStaticMarkup(
    React.createElement(LanguageProvider, null, React.createElement(GuildPluginSettings, {
      guildId: 'G1',
      onSaved: () => undefined,
      plugin: {
        name: manifest.name,
        state,
        settings: { values: globals },
        guildSettings: { fields: manifest.guildSettings, values: resolveGuildSettings(manifest.guildSettings, stored, globals) }
      }
    }))
  );
}

describe('GuildPluginSettings (server render of the Minecraft plugin)', () => {
  it('shows every field the owner needs, in English, for an empty server', () => {
    const html = render({});
    for (const text of ['Settings for this Discord server', 'Minecraft servers', 'Nothing added yet.', '+ Add', '0/3', 'Save server settings']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('The plugin is not running yet');
  });

  it('renders an item with its address, port, channel and interval controls', () => {
    const html = render({
      servers: [
        { id: 'abcdef12', name: 'Survival', host: 'play.example.com', port: 25566, edition: 'java', channel: CHANNEL, statChannel: '', interval: 15, showPlayers: true, notify: false, language: 'sk' }
      ]
    });
    expect(html).toContain('Survival');
    expect(html).toContain('value="play.example.com"');
    expect(html).toContain('value="25566"');
    expect(html).toContain('value="15"');
    expect(html).toContain('1/3');
    for (const label of ['Server name', 'Address', 'Port', 'Edition', 'Status channel', 'Update every (minutes)', 'Channel to rename (optional)', 'Show player names', 'Announce offline / online', 'Language of the message']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('<option value="bedrock">Bedrock</option>');
    expect(html).toContain('Slovenčina');
    expect(html).toContain('- choose a channel -');
    expect(html).toContain('Remove');
  });

  it('keeps a saved channel selectable even before the channel list has loaded', () => {
    const html = render({ servers: [{ id: 'abcdef12', name: 'S', host: 'h.example.com', channel: CHANNEL }] });
    expect(html).toContain(`<option value="${CHANNEL}" selected="">${CHANNEL}</option>`);
  });

  it('warns when the plugin is not running yet and disables adding at the limit', () => {
    const three = Array.from({ length: 3 }, (_, i) => ({ id: `abcdef1${i}`, name: `S${i}`, host: `h${i}.example.com`, channel: CHANNEL }));
    const html = render({ servers: three }, 'restart_enable');
    expect(html).toContain('The plugin is not running yet');
    expect(html).toContain('Limit reached (3).');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>\+ Add<\/button>/);
  });
});

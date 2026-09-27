import fsSync from 'fs';
import { fileURLToPath } from 'url';
import pathSync from 'path';
import { Collection } from '@discordjs/collection';
import { SlashCommandBuilder } from 'discord.js';
import { afterEach, describe, expect, it } from 'vitest';
import { tokenize, usageHint } from '../src/bot/modules/prefixBridge';
import {
  DISCORD_GLOBAL_COMMAND_LIMIT,
  LOW_PRIORITY_COMMANDS,
  getDisabledCommands,
  selectCommandsForRegistration,
} from '../src/bot/modules/commandRegistry';
import type { Command } from '../src/bot/types';

describe('tokenize', () => {
  it('rozdelí obyčajné argumenty', () => {
    expect(tokenize('ban @x spam')).toEqual(['ban', '@x', 'spam']);
  });

  it('viacnásobné medzery neprodukujú prázdne tokeny', () => {
    expect(tokenize('ban    @x')).toEqual(['ban', '@x']);
  });

  it('dvojité úvodzovky držia text pokope', () => {
    expect(tokenize('ban @x "dôvod s medzerami"')).toEqual(['ban', '@x', 'dôvod s medzerami']);
  });

  it('jednoduché úvodzovky fungujú rovnako', () => {
    expect(tokenize("warn @x 'druhé varovanie'")).toEqual(['warn', '@x', 'druhé varovanie']);
  });

  it('prázdne úvodzovky dajú prázdny token', () => {
    expect(tokenize('say ""')).toEqual(['say', '']);
  });

  it('prázdny vstup vráti prázdny zoznam', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('    ')).toEqual([]);
  });

  it('zachová diakritiku a emoji', () => {
    expect(tokenize('say Príliš žltý kôň 🎲')).toEqual(['say', 'Príliš', 'žltý', 'kôň', '🎲']);
  });

  it('nový riadok sa berie ako oddeľovač', () => {
    expect(tokenize('say ahoj\nsvet')).toEqual(['say', 'ahoj', 'svet']);
  });
});

describe('usageHint', () => {
  const command = (data: any): Command => ({ data, category: 'test', execute: async () => {} });

  it('vypíše povinné a voliteľné argumenty', () => {
    const data = new SlashCommandBuilder()
      .setName('ban')
      .setDescription('ban')
      .addUserOption((o) => o.setName('user').setDescription('kto').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('prečo'));

    expect(usageHint(command(data), '!')).toBe('!ban <user> [reason]');
  });

  it('pri podpríkazoch vypíše ich zoznam', () => {
    const data = new SlashCommandBuilder()
      .setName('economy')
      .setDescription('ekonomika')
      .addSubcommand((s) => s.setName('balance').setDescription('zostatok'))
      .addSubcommand((s) => s.setName('daily').setDescription('denná odmena'));

    expect(usageHint(command(data), '!')).toBe('!economy <balance | daily>');
  });

  it('príkaz bez argumentov je len meno', () => {
    const data = new SlashCommandBuilder().setName('ping').setDescription('ping');
    expect(usageHint(command(data), '?')).toBe('?ping');
  });
});

function makeCommand(name: string): Command {
  return {
    data: new SlashCommandBuilder().setName(name).setDescription(name),
    category: 'test',
    execute: async () => {},
  };
}

function makeCollection(names: string[]): Collection<string, Command> {
  const collection = new Collection<string, Command>();
  for (const name of names) collection.set(name, makeCommand(name));
  return collection;
}

describe('výber príkazov na registráciu', () => {
  afterEach(() => {
    delete process.env.DISABLED_COMMANDS;
  });

  it('pod limitom prejdú všetky', () => {
    const result = selectCommandsForRegistration(makeCollection(['ping', 'ban', 'rank']), 10);
    expect(result.overLimit).toBe(false);
    expect(result.selected).toHaveLength(3);
    expect(result.dropped).toEqual([]);
  });

  it('DISABLED_COMMANDS sa odoberú bez ohľadu na limit', () => {
    process.env.DISABLED_COMMANDS = 'ping, RANK';
    const result = selectCommandsForRegistration(makeCollection(['ping', 'ban', 'rank']), 10);
    expect(result.selected.map((c) => c.data.name).sort()).toEqual(['ban']);
    expect(result.disabled).toEqual(['ping', 'rank']);
  });

  it('nad limitom padnú najprv doplnkové príkazy', () => {
    const optional = LOW_PRIORITY_COMMANDS[0];
    const result = selectCommandsForRegistration(makeCollection(['ban', 'kick', optional]), 2);
    expect(result.overLimit).toBe(true);
    expect(result.dropped).toEqual([optional]);
    expect(result.selected.map((c) => c.data.name).sort()).toEqual(['ban', 'kick']);
  });

  it('doplnkové príkazy padajú v definovanom poradí', () => {
    const [first, second, third] = LOW_PRIORITY_COMMANDS;
    const result = selectCommandsForRegistration(makeCollection(['ban', first, second, third]), 2);
    expect(result.dropped).toEqual([first, second]);
  });

  it('zoznam doplnkových príkazov obsahuje len existujúce príkazy', () => {
    const known = new Set<string>();
    const root = fileURLToPath(new URL('../src/bot/commands/', import.meta.url));
    for (const folder of fsSync.readdirSync(root)) {
      const dir = pathSync.join(root, folder);
      if (!fsSync.statSync(dir).isDirectory()) continue;
      for (const file of fsSync.readdirSync(dir)) {
        if (file.endsWith('.ts')) known.add(file.replace(/\.ts$/, ''));
      }
    }

    const missing = LOW_PRIORITY_COMMANDS.filter((name) => !known.has(name));
    expect(missing).toEqual([]);
  });

  it('keď doplnkové nestačia, reže sa od konca abecedy', () => {
    const result = selectCommandsForRegistration(makeCollection(['alfa', 'beta', 'gama']), 1);
    expect(result.selected.map((c) => c.data.name)).toEqual(['alfa']);
    expect(result.dropped.sort()).toEqual(['beta', 'gama']);
  });

  it('nikdy nezostane viac než limit', () => {
    const names = Array.from({ length: 130 }, (_, i) => `cmd${String(i).padStart(3, '0')}`);
    const result = selectCommandsForRegistration(makeCollection(names));
    expect(result.selected).toHaveLength(DISCORD_GLOBAL_COMMAND_LIMIT);
  });

  it('zoznam doplnkových príkazov nemá duplikáty', () => {
    expect(new Set(LOW_PRIORITY_COMMANDS).size).toBe(LOW_PRIORITY_COMMANDS.length);
  });

  it('prázdna premenná neznamená vypnutý príkaz', () => {
    process.env.DISABLED_COMMANDS = '';
    expect(getDisabledCommands()).toEqual([]);
  });
});

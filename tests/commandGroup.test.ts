import fs from 'fs';
import path from 'path';
import { ApplicationCommandOptionType, SlashCommandBuilder } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { buildCommandGroup, resolveGroupedCommand } from '../src/bot/modules/commandGroup';
import { DISCORD_GLOBAL_COMMAND_LIMIT } from '../src/bot/modules/commandRegistry';
import type { Command } from '../src/bot/types';

function plain(name: string): Command {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(`popis ${name}`)
      .addUserOption((o) => o.setName('user').setDescription('kto')),
    category: 'economy',
    guildOnly: true,
    execute: async () => {},
  };
}

function withSubs(name: string): Command {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(`popis ${name}`)
      .addSubcommand((s) => s.setName('deposit').setDescription('vlož'))
      .addSubcommand((s) => s.setName('withdraw').setDescription('vyber')),
    category: 'economy',
    guildOnly: true,
    execute: async () => {},
  };
}

describe('buildCommandGroup - definícia', () => {
  const group = buildCommandGroup({
    name: 'skupina',
    description: 'testovacia skupina',
    category: 'economy',
    children: [plain('daily'), withSubs('bank')],
  });
  const json: any = group.data.toJSON();

  it('skupina má vlastné meno a popis', () => {
    expect(json.name).toBe('skupina');
    expect(group.data.name).toBe('skupina');
    expect((group.data as any).description).toBe('testovacia skupina');
  });

  it('dieťa bez podpríkazov sa stane podpríkazom', () => {
    const daily = json.options.find((o: any) => o.name === 'daily');
    expect(daily.type).toBe(ApplicationCommandOptionType.Subcommand);
    expect(daily.description).toBe('popis daily');
    expect(daily.options.map((o: any) => o.name)).toEqual(['user']);
  });

  it('dieťa s podpríkazmi sa stane skupinou podpríkazov', () => {
    const bank = json.options.find((o: any) => o.name === 'bank');
    expect(bank.type).toBe(ApplicationCommandOptionType.SubcommandGroup);
    expect(bank.options.map((o: any) => o.name)).toEqual(['deposit', 'withdraw']);
  });

  it('skupina je guildOnly, len keď sú ním všetky deti', () => {
    expect(group.guildOnly).toBe(true);
    const mixed = buildCommandGroup({
      name: 'mix', description: 'x', category: 'economy',
      children: [plain('a'), { ...plain('b'), guildOnly: false }],
    });
    expect(mixed.guildOnly).toBe(false);
  });
});

describe('buildCommandGroup - obmedzenia', () => {
  it('viac než 25 podpríkazov Discord neprijme', () => {
    const children = Array.from({ length: 26 }, (_, i) => plain(`cmd${i}`));
    expect(() =>
      buildCommandGroup({ name: 'velka', description: 'x', category: 'economy', children })
    ).toThrow(/25/);
  });

  it('dieťa s vlastnými skupinami sa vnoriť nedá', () => {
    const nested: Command = {
      data: new SlashCommandBuilder()
        .setName('vnorene')
        .setDescription('x')
        .addSubcommandGroup((g) =>
          g.setName('g').setDescription('g').addSubcommand((s) => s.setName('s').setDescription('s'))
        ),
      category: 'economy',
      execute: async () => {},
    };
    expect(() =>
      buildCommandGroup({ name: 'skupina2', description: 'x', category: 'economy', children: [nested] })
    ).toThrow(/vnoriť/);
  });
});

describe('prefixové aliasy', () => {
  it('pôvodné meno vedie na skupinu a cestu k podpríkazu', () => {
    buildCommandGroup({
      name: 'ekonomika',
      description: 'x',
      category: 'economy',
      children: [plain('vyplata')],
    });
    expect(resolveGroupedCommand('vyplata')).toEqual({ group: 'ekonomika', path: ['vyplata'] });
    expect(resolveGroupedCommand('VYPLATA')).toEqual({ group: 'ekonomika', path: ['vyplata'] });
  });

  it('neznáme meno nevráti nič', () => {
    expect(resolveGroupedCommand('neexistuje')).toBeUndefined();
  });
});

describe('skutočný príkaz /economy', () => {
  it('poskladá sa z dvanástich detí bez chyby', async () => {
    const economy = (await import('../src/bot/commands/economy/economy')).default;
    const json: any = economy.data.toJSON();

    expect(json.name).toBe('economy');
    expect(json.options).toHaveLength(12);

    const subs = json.options.filter((o: any) => o.type === ApplicationCommandOptionType.Subcommand);
    const groups = json.options.filter((o: any) => o.type === ApplicationCommandOptionType.SubcommandGroup);

    expect(subs.map((o: any) => o.name).sort()).toEqual(
      ['balance', 'daily', 'heist', 'pay', 'rob', 'spin', 'work']
    );
    expect(groups.map((o: any) => o.name).sort()).toEqual(
      ['bank', 'casino', 'lootbox', 'market', 'shop']
    );
  });

  it('pôvodné mená sa dajú volať cez prefix', async () => {
    await import('../src/bot/commands/economy/economy');
    expect(resolveGroupedCommand('daily')).toEqual({ group: 'economy', path: ['daily'] });
    expect(resolveGroupedCommand('bank')).toEqual({ group: 'economy', path: ['bank'] });
  });

  it('každý podpríkaz má popis a povolený počet možností', async () => {
    const economy = (await import('../src/bot/commands/economy/economy')).default;
    const json: any = economy.data.toJSON();
    for (const option of json.options) {
      expect(option.description, option.name).toBeTruthy();
      expect((option.options || []).length).toBeLessThanOrEqual(25);
    }
  });
});

describe('tematické skupiny nástrojov', () => {
  const cases: Array<[string, string, string[]]> = [
    ['crypto', '../src/bot/commands/utility/crypto', ['price', 'nft', 'stock']],
    ['info', '../src/bot/commands/utility/info', ['user', 'server', 'avatar', 'members', 'names', 'health', 'ping']],
    ['tools', '../src/bot/commands/utility/tools',
      ['reminder', 'schedule', 'tags', 'sticky', 'say', 'announce', 'wiki', 'mcstatus', 'backup']],
  ];

  for (const [name, modulePath, expected] of cases) {
    it(`/${name} obsahuje očakávané podpríkazy`, async () => {
      const group = (await import(modulePath)).default;
      const json: any = group.data.toJSON();
      expect(json.name).toBe(name);
      expect(json.options.map((o: any) => o.name)).toEqual(expected);
    });
  }

  it('premenované podpríkazy sa dajú volať pôvodným menom', async () => {
    await import('../src/bot/commands/utility/crypto');
    await import('../src/bot/commands/utility/info');

    expect(resolveGroupedCommand('crypto')).toEqual({ group: 'crypto', path: ['price'] });
    expect(resolveGroupedCommand('userinfo')).toEqual({ group: 'info', path: ['user'] });
    expect(resolveGroupedCommand('serverhealth')).toEqual({ group: 'info', path: ['health'] });
  });

  it('dva rovnaké podpríkazy v skupine neprejdú', () => {
    expect(() =>
      buildCommandGroup({
        name: 'kolizia', description: 'x', category: 'utility',
        children: [plain('a'), { command: plain('b'), as: 'a' }],
      })
    ).toThrow(/dva podpríkazy/);
  });
});

describe('počet registrovaných príkazov', () => {
  const root = path.resolve(__dirname, '../src/bot/commands');

  it('načítavač vidí len jednu úroveň, takže parts/ sa neregistruje', () => {
    expect(fs.existsSync(path.join(root, 'economy/parts'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'utility/parts'))).toBe(true);

    expect(fs.readdirSync(path.join(root, 'economy')).filter((f) => f.endsWith('.ts'))).toEqual([
      'economy.ts',
    ]);
    const utility = fs.readdirSync(path.join(root, 'utility')).filter((f) => f.endsWith('.ts'));
    expect(utility).toContain('info.ts');
    expect(utility).toContain('tools.ts');
    expect(utility).not.toContain('userinfo.ts');
  });

  it('moderácia zostala nedotknutá', () => {
    expect(fs.existsSync(path.join(root, 'moderation/parts'))).toBe(false);
    expect(
      fs.readdirSync(path.join(root, 'moderation')).filter((f) => f.endsWith('.ts')).length
    ).toBe(33);
  });

  it('príkazov je menej než limit Discordu', () => {
    const total = fs
      .readdirSync(root)
      .filter((folder) => fs.statSync(path.join(root, folder)).isDirectory())
      .reduce(
        (sum, folder) =>
          sum + fs.readdirSync(path.join(root, folder)).filter((f) => f.endsWith('.ts')).length,
        0
      );
    expect(total).toBeLessThanOrEqual(DISCORD_GLOBAL_COMMAND_LIMIT);
  });
});

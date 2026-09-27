import { describe, expect, it } from 'vitest';
import {
  SETTINGS_SCHEMA_VERSION,
  migrateAllRecords,
  migrateGuildRecord,
  readSchemaVersion,
} from '../src/shared/settingsMigrations';

const migrate = (record: any) => migrateGuildRecord(record).record;

describe('verzia schémy', () => {
  it('chýbajúca verzia znamená nulu', () => {
    expect(readSchemaVersion({})).toBe(0);
    expect(readSchemaVersion(null)).toBe(0);
    expect(readSchemaVersion({ schema_version: 'nezmysel' })).toBe(0);
  });

  it('migrácia označí záznam aktuálnou verziou', () => {
    expect(migrate({ guild_id: '1' }).schema_version).toBe(SETTINGS_SCHEMA_VERSION);
  });

  it('aktuálny záznam sa už nemigruje', () => {
    const result = migrateGuildRecord({ guild_id: '1', schema_version: SETTINGS_SCHEMA_VERSION });
    expect(result.changed).toBe(false);
    expect(result.applied).toEqual([]);
  });

  it('pôvodný objekt sa nemení', () => {
    const original = { guild_id: '1', modules: { logging: true } };
    migrateGuildRecord(original);
    expect(original.modules).toEqual({ logging: true });
  });
});

describe('v1 - mená modulov', () => {
  it('logging sa premenuje na logs', () => {
    const out = migrate({ guild_id: '1', modules: { logging: true } });
    expect(out.modules.logs).toBe(true);
    expect(out.modules.logging).toBeUndefined();
  });

  it('tempchannels sa premenuje na tempChannels', () => {
    const out = migrate({ guild_id: '1', modules: { tempchannels: { enabled: true } } });
    expect(out.modules.tempChannels).toBe(true);
    expect(out.modules.tempchannels).toBeUndefined();
    expect(out.temp_channels).toEqual({ enabled: true });
  });

  it('nastavenie docasnych kanalov sa presunie z modulu do temp_channels', () => {
    const out = migrate({
      guild_id: '1',
      modules: {
        tempChannels: {
          enabled: true,
          triggerChannel: '111',
          defaultName: '{user} room',
          defaultBitrate: 96000,
          defaultUserLimit: 5,
        },
      },
    });
    expect(out.modules.tempChannels).toBe(true);
    expect(out.temp_channels).toEqual({
      enabled: true,
      hubChannel: '111',
      nameFormat: '{user} room',
      bitrate: 96000,
      userLimit: 5,
    });
  });

  it('logovanie sa zjednoti do jedneho kluca', () => {
    const out = migrate({
      guild_id: '1',
      modules: { logs: { enabled: true, channels: { messages: '222' }, events: { messageEdit: false } } },
      log_channels: { members: '333' },
    });
    expect(out.modules.logs).toBe(true);
    expect(out.logs.enabled).toBe(true);
    expect(out.logs.channels).toEqual({ messages: '222', members: '333' });
    expect(out.logs.events).toEqual({ messageEdit: false });
    expect(out.log_channels).toBeUndefined();
  });

  it('leveling sa prepise na tvar, ktory pouziva dashboard', () => {
    const out = migrate({
      guild_id: '1',
      leveling: {
        xpPerMessage: { min: 10, max: 30 },
        xpCooldown: 60000,
        ignoredRoles: ['r1'],
        roleRewards: { 5: 'role5', 10: 'role10' },
      },
    });
    expect(out.leveling.xpMin).toBe(10);
    expect(out.leveling.xpMax).toBe(30);
    expect(out.leveling.xpCooldown).toBe(60);
    expect(out.leveling.noXpRoles).toEqual(['r1']);
    expect(out.leveling.roleRewards).toEqual([
      { level: 5, roleId: 'role5' },
      { level: 10, roleId: 'role10' },
    ]);
  });

  it('antiraid a autoresponse sa zjednotia', () => {
    const out = migrate({ guild_id: '1', modules: { antiraid: true, autoresponse: true } });
    expect(out.modules.antiRaid).toBe(true);
    expect(out.modules.autoResponse).toBe(true);
  });

  it('novšie meno prežije, ak sú prítomné obe', () => {
    const out = migrate({ guild_id: '1', modules: { logging: true, logs: false } });
    expect(out.modules.logs).toBe(false);
    expect(out.modules.logging).toBeUndefined();
  });

  it('nastavenie počítania sa presunie z modulu na spoločný kľúč', () => {
    const out = migrate({
      guild_id: '1',
      modules: { counting: { enabled: true, channel: '42', deleteWrong: true } },
    });
    expect(out.modules.counting).toBe(true);
    expect(out.counting).toEqual({ channel: '42', deleteWrong: true });
  });

  it('existujúci spoločný kľúč má prednosť pred presunutým', () => {
    const out = migrate({
      guild_id: '1',
      counting: { channel: 'novy' },
      modules: { counting: { enabled: true, channel: 'stary' } },
    });
    expect(out.counting.channel).toBe('novy');
  });
});

describe('v1 - hry', () => {
  it('boolean sa zmení na objekt', () => {
    const out = migrate({ guild_id: '1', games: { dice: true, rps: false } });
    expect(out.games.dice).toEqual({ enabled: true });
    expect(out.games.rps).toEqual({ enabled: false });
  });

  it('objekt s nastavením zostane nedotknutý', () => {
    const out = migrate({ guild_id: '1', games: { trivia: { enabled: true, cooldown: 30 } } });
    expect(out.games.trivia).toEqual({ enabled: true, cooldown: 30 });
  });

  it('hra, ktorá v bote neexistuje, sa odstráni', () => {
    const out = migrate({ guild_id: '1', games: { hangman: true, wordle: { enabled: true }, dice: true } });
    expect(out.games.hangman).toBeUndefined();
    expect(out.games.wordle).toBeUndefined();
    expect(out.games.dice).toEqual({ enabled: true });
  });

  it('rozsah kanálov pre neexistujúcu hru sa odstráni', () => {
    const out = migrate({
      guild_id: '1',
      channel_scopes: {
        'games.hangman': { mode: 'only', channels: ['1'] },
        'games.dice': { mode: 'only', channels: ['2'] },
        leveling: { mode: 'except', channels: ['3'] },
      },
    });
    expect(out.channel_scopes['games.hangman']).toBeUndefined();
    expect(out.channel_scopes['games.dice']).toEqual({ mode: 'only', channels: ['2'] });
    expect(out.channel_scopes.leveling).toEqual({ mode: 'except', channels: ['3'] });
  });
});

describe('v1 - stĺpce', () => {
  it('camelCase kľúč na disku sa presunie na stĺpec', () => {
    const out = migrate({ guild_id: '1', prefixCommands: { enabled: false, aliases: { b: 'ban' } } });
    expect(out.prefix_commands).toEqual({ enabled: false, aliases: { b: 'ban' } });
    expect(out.prefixCommands).toBeUndefined();
  });

  it('existujúci stĺpec sa camelCase kľúčom neprepíše', () => {
    const out = migrate({ guild_id: '1', temp_channels: { enabled: true }, tempChannels: { enabled: false } });
    expect(out.temp_channels).toEqual({ enabled: true });
    expect(out.tempChannels).toBeUndefined();
  });
});

describe('v2 - záchrana AutoMod nastavenia', () => {
  it('prepínače sa presunú do vetiev', () => {
    const out = migrate({
      guild_id: '1',
      automod: { enabled: true, antiSpam: true, antiLinks: true, antiScam: false },
    });
    expect(out.automod.spam.enabled).toBe(true);
    expect(out.automod.links.enabled).toBe(true);
    expect(out.automod.phishing.enabled).toBe(false);
    expect(out.automod.antiSpam).toBeUndefined();
  });

  it('limity sa presunú na správne kľúče', () => {
    const out = migrate({
      guild_id: '1',
      automod: { maxMentions: 8, maxEmojis: 12, maxCaps: 60, muteDuration: 900 },
    });
    expect(out.automod.mentions.maxMentions).toBe(8);
    expect(out.automod.emojis.maxEmojis).toBe(12);
    expect(out.automod.caps.percentage).toBe(60);
    expect(out.automod.spam.duration).toBe(900);
  });

  it('zoznam zakázaných slov sa nestratí', () => {
    const out = migrate({ guild_id: '1', automod: { blacklistedWords: ['kokot', 'piča'] } });
    expect(out.automod.blacklist).toEqual(['kokot', 'piča']);
    expect(out.automod.blacklistedWords).toBeUndefined();
  });

  it('imunné role a kanály sa presunú', () => {
    const out = migrate({
      guild_id: '1',
      automod: { whitelistedRoles: ['r1', 'r2'], whitelistedChannels: ['c1'] },
    });
    expect(out.automod.bypassRoles).toEqual(['r1', 'r2']);
    expect(out.automod.ignoredChannels).toEqual(['c1']);
  });

  it('už nastavená hodnota sa starou neprepíše', () => {
    const out = migrate({
      guild_id: '1',
      automod: { blacklist: ['nove'], blacklistedWords: ['stare'], spam: { enabled: false }, antiSpam: true },
    });
    expect(out.automod.blacklist).toEqual(['nove']);
    expect(out.automod.spam.enabled).toBe(false);
  });

  it('filter, ktorý bot nemá, sa zahodí', () => {
    const out = migrate({ guild_id: '1', automod: { antiNewlines: true } });
    expect(out.automod.antiNewlines).toBeUndefined();
  });

  it('server bez automodu prežije', () => {
    expect(() => migrate({ guild_id: '1' })).not.toThrow();
  });
});

describe('opakovanie a dávky', () => {
  it('migrácia je idempotentná', () => {
    const input = {
      guild_id: '1',
      modules: { logging: true, tempchannels: true, counting: { enabled: true, channel: '9' } },
      games: { dice: true, hangman: true },
      prefixCommands: { enabled: true },
    };
    const once = migrate(input);
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });

  it('dávka označí zmenu, len keď sa naozaj niečo zmenilo', () => {
    const current = { guild_id: '1', schema_version: SETTINGS_SCHEMA_VERSION };
    expect(migrateAllRecords([current]).changed).toBe(false);
    expect(migrateAllRecords([{ guild_id: '2' }]).changed).toBe(true);
  });

  it('nepole vráti prázdny výsledok', () => {
    expect(migrateAllRecords(null as any)).toEqual({ records: [], changed: false });
  });

  it('žiadne dáta sa pri migrácii nestratia', () => {
    const out = migrate({
      guild_id: '1',
      welcome_channel: '111',
      custom_texts: { hello: 'ahoj' },
      niecoCudzie: 42,
    });
    expect(out.welcome_channel).toBe('111');
    expect(out.custom_texts).toEqual({ hello: 'ahoj' });
    expect(out.niecoCudzie).toBe(42);
  });
});

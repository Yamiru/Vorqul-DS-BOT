import { describe, expect, it } from 'vitest';
import {
  detectCryptoScam,
  detectCustomRegex,
  detectFakeNitro,
  detectMassMention,
  detectPhishing,
  extractDomains,
  extractMentionTargets,
  normalizeForMatching,
  validateRegex,
} from '../src/utils/automodDetectors';

describe('extractDomains', () => {
  it('vytiahne doménu z odkazu a zahodí www', () => {
    expect(extractDomains('pozri https://www.Example.com/cesta')).toEqual(['example.com']);
  });

  it('nájde viac odkazov naraz', () => {
    expect(extractDomains('http://a.sk a tiež https://b.eu/x')).toEqual(['a.sk', 'b.eu']);
  });

  it('bez odkazu vráti prázdny zoznam', () => {
    expect(extractDomains('obyčajný text bez odkazu')).toEqual([]);
  });

  it('neplatnú adresu preskočí', () => {
    expect(extractDomains('https://')).toEqual([]);
  });
});

describe('normalizeForMatching', () => {
  it('odstráni diakritiku', () => {
    expect(normalizeForMatching('Príliš žltý kôň')).toBe('prilis zlty kon');
  });

  it('zjednotí znaky používané na obchádzanie filtra', () => {
    expect(normalizeForMatching('n1tr0')).toBe('nitro');
    expect(normalizeForMatching('$p4m')).toBe('spam');
  });

  it('odstráni neviditeľné znaky', () => {
    expect(normalizeForMatching('ni\u200btro')).toBe('nitro');
  });
});

describe('detectPhishing', () => {
  it('odhalí doménu vydávajúcu sa za Discord', () => {
    const result = detectPhishing('klikni https://discord-nitro.xyz/free');
    expect(result.matched).toBe(true);
    expect(result.reason).toBe('phishing');
    expect(result.evidence).toBe('discord-nitro.xyz');
  });

  it('odhalí zámenu znakov v názve značky', () => {
    expect(detectPhishing('https://disc0rd.gift/abc').matched).toBe(true);
  });

  it('odhalí napodobeninu Steamu', () => {
    expect(detectPhishing('https://steamcommunity.ru/gift').matched).toBe(true);
  });

  it('skutočné domény nehlási', () => {
    expect(detectPhishing('https://discord.com/channels/1/2').matched).toBe(false);
    expect(detectPhishing('https://cdn.discordapp.com/x.png').matched).toBe(false);
    expect(detectPhishing('https://store.steampowered.com/app/1').matched).toBe(false);
  });

  it('podozrivá TLD sama o sebe nestačí', () => {
    expect(detectPhishing('môj blog https://mojblog.xyz').matched).toBe(false);
  });

  it('podozrivá TLD s výzvou na akciu už áno', () => {
    expect(detectPhishing('claim your reward https://odmena.top').matched).toBe(true);
  });

  it('bežný text nehlási', () => {
    expect(detectPhishing('ahoj, ako sa máš?').matched).toBe(false);
  });
});

describe('detectFakeNitro', () => {
  it('odhalí ponuku nitra s odkazom', () => {
    expect(detectFakeNitro('free nitro https://neco.tk').matched).toBe(true);
  });

  it('rozumie aj slovenskému zneniu', () => {
    expect(detectFakeNitro('nitro zdarma https://neco.tk').matched).toBe(true);
  });

  it('bez odkazu nehlási', () => {
    expect(detectFakeNitro('kto dá free nitro?').matched).toBe(false);
  });

  it('bežná zmienka o nitre nehlási', () => {
    expect(detectFakeNitro('mám nitro už rok, viď https://discord.com').matched).toBe(false);
  });
});

describe('detectCryptoScam', () => {
  it('odhalí typický podvod', () => {
    expect(detectCryptoScam('send 1 btc get 2 back, guaranteed profit').matched).toBe(true);
  });

  it('odhalí výzvu na pripojenie peňaženky', () => {
    expect(detectCryptoScam('free airdrop, connect your wallet metamask').matched).toBe(true);
  });

  it('bežná debata o krypte nehlási', () => {
    expect(detectCryptoScam('bitcoin dnes spadol o 3 percentá').matched).toBe(false);
  });

  it('bez krypto slov nehlási', () => {
    expect(detectCryptoScam('guaranteed profit na burze').matched).toBe(false);
  });
});

describe('vlastné regexy', () => {
  it('validateRegex prijme platný vzor', () => {
    expect(validateRegex('^ahoj')).toEqual({ valid: true });
  });

  it('validateRegex odmietne chybný vzor', () => {
    const result = validateRegex('[nezavreta');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('validateRegex odmietne príliš dlhý vzor', () => {
    expect(validateRegex('a'.repeat(301)).valid).toBe(false);
  });

  it('detectCustomRegex nájde zhodu a vráti popis', () => {
    const result = detectCustomRegex('toto je zakazane', [{ pattern: 'zakazan', label: 'moje pravidlo' }]);
    expect(result.matched).toBe(true);
    expect(result.evidence).toBe('moje pravidlo');
  });

  it('chybný vzor sa ticho preskočí', () => {
    const result = detectCustomRegex('text', [{ pattern: '[' }, { pattern: 'text' }]);
    expect(result.matched).toBe(true);
  });

  it('prázdny zoznam pravidiel nič nehlási', () => {
    expect(detectCustomRegex('text', []).matched).toBe(false);
    expect(detectCustomRegex('text', null as any).matched).toBe(false);
  });

  it('globálny vzor nepreskakuje zhody pri opakovanom volaní', () => {
    const rules = [{ pattern: 'spam', flags: 'gi' }];
    expect(detectCustomRegex('spam', rules).matched).toBe(true);
    expect(detectCustomRegex('spam', rules).matched).toBe(true);
  });
});

describe('detectMassMention', () => {
  it('počíta unikátnych používateľov', () => {
    const content = '<@100000000000000001> <@100000000000000001> <@100000000000000002>';
    expect(detectMassMention(content, 5).matched).toBe(false);
    expect(detectMassMention(content, 1).matched).toBe(true);
  });

  it('počíta aj role', () => {
    const content = '<@&100000000000000001> <@&100000000000000002> <@&100000000000000003>';
    expect(detectMassMention(content, 2).matched).toBe(true);
  });

  it('everyone sa počíta ako jedno označenie', () => {
    expect(detectMassMention('@everyone', 0).matched).toBe(true);
    expect(detectMassMention('@everyone', 1).matched).toBe(false);
  });

  it('everyone sa dá z počítania vypnúť', () => {
    expect(detectMassMention('@everyone', 0, false).matched).toBe(false);
  });

  it('bežná správa nehlási', () => {
    expect(detectMassMention('ahoj <@100000000000000001>', 5).matched).toBe(false);
  });
});

describe('extractMentionTargets', () => {
  it('vráti unikátne ID používateľov a rolí', () => {
    const content = '<@100000000000000001> <@!100000000000000001> <@&100000000000000002>';
    expect(extractMentionTargets(content)).toEqual(['100000000000000001', '100000000000000002']);
  });

  it('bez zmienok vráti prázdny zoznam', () => {
    expect(extractMentionTargets('nič tu nie je')).toEqual([]);
  });
});

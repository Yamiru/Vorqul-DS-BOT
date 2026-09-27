/*!
 * Vorqul DS BOT - AutoMod Detectors
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { logger } from '../utils/logger.js';
export interface DetectionResult {
  matched: boolean;
  reason: string;
  evidence?: string;
}

const NO_MATCH: DetectionResult = { matched: false, reason: '' };

export function extractDomains(content: string): string[] {
  const urls = content.match(/https?:\/\/[^\s<>"']+/gi) || [];
  const domains: string[] = [];

  for (const url of urls) {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      domains.push(host);
    } catch (error) {
        logger.debug('automodDetectors: suppressed error', error);
      }
  }
  return domains;
}

export function normalizeForMatching(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[0]/g, 'o')
    .replace(/[1|!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7]/g, 't')
    .replace(/[\u200b-\u200f\u2060\ufeff]/g, '');
}

const LOOKALIKE_TARGETS = ['discord', 'discordapp', 'discordgift', 'steamcommunity', 'steampowered'];
const LEGITIMATE_HOSTS = new Set([
  'discord.com', 'discord.gg', 'discordapp.com', 'discordapp.net', 'discord.media',
  'discordstatus.com', 'cdn.discordapp.com', 'media.discordapp.net',
  'steamcommunity.com', 'steampowered.com', 'store.steampowered.com',
]);

const SUSPICIOUS_TLDS = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'click', 'link', 'rest', 'ru', 'su'];

export function detectPhishing(content: string): DetectionResult {
  const domains = extractDomains(content);

  for (const domain of domains) {
    if (LEGITIMATE_HOSTS.has(domain)) continue;

    const parts = domain.split('.');
    const tld = parts[parts.length - 1];
    const withoutTld = parts.slice(0, -1).join('.');
    const normalized = normalizeForMatching(withoutTld).replace(/[^a-z]/g, '');

    for (const target of LOOKALIKE_TARGETS) {
      if (normalized.includes(target)) {
        return {
          matched: true,
          reason: 'phishing',
          evidence: domain,
        };
      }
    }

    if (SUSPICIOUS_TLDS.includes(tld)) {
      const normalizedContent = normalizeForMatching(content);
      if (/free|nitro|gift|giveaway|claim|verify|airdrop|zdarma|odmena/.test(normalizedContent)) {
        return { matched: true, reason: 'phishing', evidence: domain };
      }
    }
  }

  return NO_MATCH;
}

export function detectFakeNitro(content: string): DetectionResult {
  const normalized = normalizeForMatching(content);

  const offersNitro = /(free|zdarma|zadarmo|darmowy|gratis)\s*(discord\s*)?nitro/.test(normalized) ||
    /nitro\s*(for\s*free|zdarma|gift|generator)/.test(normalized) ||
    /\bnitro\s*(giveaway|drop)\b/.test(normalized);

  if (!offersNitro) return NO_MATCH;

  const hasLink = /https?:\/\//i.test(content) || /discord\.gift/i.test(normalized);
  if (!hasLink) return NO_MATCH;

  return { matched: true, reason: 'fakeNitro', evidence: 'nitro + odkaz' };
}

export function detectCryptoScam(content: string): DetectionResult {
  const normalized = normalizeForMatching(content);

  const cryptoTerms = /(bitcoin|btc|ethereum|eth|usdt|binance|metamask|airdrop|crypto|nft)/.test(normalized);
  if (!cryptoTerms) return NO_MATCH;

  const scamTerms =
    /(double\s*your|guaranteed\s*(profit|return)|send\s*\d+\s*(get|receive)|free\s*airdrop|connect\s*your\s*wallet|seed\s*phrase|private\s*key|investment\s*opportunity|garantovany\s*zisk)/
      .test(normalized);

  if (!scamTerms) return NO_MATCH;

  return { matched: true, reason: 'cryptoScam', evidence: 'krypto + typický podvodný text' };
}

export interface RegexRule {
  pattern: string;
  flags?: string;
  label?: string;
}

const regexCache = new Map<string, RegExp | null>();

const NESTED_QUANTIFIER = /\([^()]*[+*?][^()]*\)[+*]|\([^()]*\{\d*,\}[^()]*\)[+*]/;
const MAX_REGEX_TEST_LENGTH = 500;

function hasCatastrophicBacktrackingRisk(pattern: string): boolean {
  return NESTED_QUANTIFIER.test(pattern);
}

function compile(rule: RegexRule): RegExp | null {
  const key = `${rule.pattern}\u0000${rule.flags || 'i'}`;
  if (regexCache.has(key)) return regexCache.get(key)!;

  let compiled: RegExp | null = null;
  try {
    if (rule.pattern.length <= 300 && !hasCatastrophicBacktrackingRisk(rule.pattern)) {
      compiled = new RegExp(rule.pattern, rule.flags || 'i');
    }
  } catch {
    compiled = null;
  }

  regexCache.set(key, compiled);
  return compiled;
}

export function detectCustomRegex(content: string, rules: RegexRule[]): DetectionResult {
  if (!Array.isArray(rules) || rules.length === 0) return NO_MATCH;

  const bounded = content.length > MAX_REGEX_TEST_LENGTH ? content.slice(0, MAX_REGEX_TEST_LENGTH) : content;

  for (const rule of rules) {
    if (!rule?.pattern) continue;
    const compiled = compile(rule);
    if (!compiled) continue;

    compiled.lastIndex = 0;
    if (compiled.test(bounded)) {
      return {
        matched: true,
        reason: 'regex',
        evidence: rule.label || rule.pattern.slice(0, 60),
      };
    }
  }

  return NO_MATCH;
}

export function validateRegex(pattern: string, flags = 'i'): { valid: boolean; error?: string } {
  if (pattern.length > 300) {
    return { valid: false, error: 'Vzor je príliš dlhý (max 300 znakov).' };
  }
  if (hasCatastrophicBacktrackingRisk(pattern)) {
    return { valid: false, error: 'Vzor obsahuje vnorené opakovanie (napr. (a+)+), ktoré môže zablokovať bota. Zjednoduš ho.' };
  }
  try {
    new RegExp(pattern, flags);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

export function detectMassMention(
  content: string,
  maxMentions: number,
  countEveryone = true
): DetectionResult {
  const users = new Set((content.match(/<@!?(\d{15,20})>/g) || []));
  const roles = new Set((content.match(/<@&(\d{15,20})>/g) || []));

  let total = users.size + roles.size;

  if (countEveryone && /@(everyone|here)/.test(content)) {
    total += 1;
  }

  if (total > maxMentions) {
    return { matched: true, reason: 'massMention', evidence: `${total} označení` };
  }
  return NO_MATCH;
}

export function extractMentionTargets(content: string): string[] {
  const users = (content.match(/<@!?(\d{15,20})>/g) || []).map(m => m.replace(/[^\d]/g, ''));
  const roles = (content.match(/<@&(\d{15,20})>/g) || []).map(m => m.replace(/[^\d]/g, ''));
  return Array.from(new Set([...users, ...roles]));
}

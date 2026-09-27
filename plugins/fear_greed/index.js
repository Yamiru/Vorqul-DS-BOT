/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, EmbedBuilder, MessageFlags, Events } from 'discord.js';

const API_URL = 'https://api.alternative.me/fng/?limit=1';
const CACHE_MS = 30 * 60_000;
const TICK_MS = 5 * 60_000;
const STATE_FILE = 'state.json';
const SITE = 'vorqul.com';
const LANGS = ['en', 'sk', 'cs', 'de', 'pl', 'ru', 'es', 'ja', 'tr'];
const LOCALE_MAP = { 'en-US': 'en', 'en-GB': 'en', 'es-ES': 'es', 'es-419': 'es' };

const S = {
  en: {
    title: 'Crypto Fear & Greed Index',
    description: 'Current cryptocurrency market sentiment',
    currentValue: 'Current value',
    classification: 'Classification',
    interpretation: 'Interpretation',
    extremeFear: 'Extreme Fear - potential buying opportunity',
    fear: 'Fear - investors are cautious',
    neutral: 'Neutral - market is balanced',
    greed: 'Greed - optimism in the market',
    extremeGreed: 'Extreme Greed - watch for correction',
    source: 'Source',
    error: 'Could not fetch the index right now. Try again later.',
    updated: 'Updated'
  },
  sk: {
    title: 'Crypto Fear & Greed Index',
    description: 'Aktuálny sentiment kryptomenového trhu',
    currentValue: 'Aktuálna hodnota',
    classification: 'Klasifikácia',
    interpretation: 'Interpretácia',
    extremeFear: 'Extrémny strach - potenciálna nákupná príležitosť',
    fear: 'Strach - investori sú opatrní',
    neutral: 'Neutrálne - trh je vyvážený',
    greed: 'Chamtivosť - optimizmus na trhu',
    extremeGreed: 'Extrémna chamtivosť - pozor na korekciu',
    source: 'Zdroj',
    error: 'Index sa teraz nepodarilo načítať. Skús to neskôr.',
    updated: 'Aktualizované'
  },
  cs: {
    title: 'Crypto Fear & Greed Index',
    description: 'Aktuální sentiment kryptoměnového trhu',
    currentValue: 'Aktuální hodnota',
    classification: 'Klasifikace',
    interpretation: 'Interpretace',
    extremeFear: 'Extrémní strach - potenciální nákupní příležitost',
    fear: 'Strach - investoři jsou opatrní',
    neutral: 'Neutrální - trh je vyvážený',
    greed: 'Chamtivost - optimismus na trhu',
    extremeGreed: 'Extrémní chamtivost - pozor na korekci',
    source: 'Zdroj',
    error: 'Index se nyní nepodařilo načíst. Zkus to později.',
    updated: 'Aktualizováno'
  },
  de: {
    title: 'Krypto Angst-&-Gier-Index',
    description: 'Aktuelle Stimmung am Kryptomarkt',
    currentValue: 'Aktueller Wert',
    classification: 'Einstufung',
    interpretation: 'Interpretation',
    extremeFear: 'Extreme Angst - mögliche Kaufgelegenheit',
    fear: 'Angst - Anleger sind vorsichtig',
    neutral: 'Neutral - der Markt ist ausgeglichen',
    greed: 'Gier - Optimismus am Markt',
    extremeGreed: 'Extreme Gier - Vorsicht vor einer Korrektur',
    source: 'Quelle',
    error: 'Der Index konnte gerade nicht abgerufen werden. Versuche es später erneut.',
    updated: 'Aktualisiert'
  },
  pl: {
    title: 'Crypto Fear & Greed Index',
    description: 'Aktualne nastroje na rynku kryptowalut',
    currentValue: 'Aktualna wartość',
    classification: 'Klasyfikacja',
    interpretation: 'Interpretacja',
    extremeFear: 'Skrajny strach - potencjalna okazja do zakupu',
    fear: 'Strach - inwestorzy są ostrożni',
    neutral: 'Neutralnie - rynek jest zrównoważony',
    greed: 'Chciwość - optymizm na rynku',
    extremeGreed: 'Skrajna chciwość - uwaga na korektę',
    source: 'Źródło',
    error: 'Nie udało się teraz pobrać indeksu. Spróbuj później.',
    updated: 'Zaktualizowano'
  },
  ru: {
    title: 'Crypto Fear & Greed Index',
    description: 'Текущие настроения на рынке криптовалют',
    currentValue: 'Текущее значение',
    classification: 'Классификация',
    interpretation: 'Интерпретация',
    extremeFear: 'Экстремальный страх - возможная точка входа',
    fear: 'Страх - инвесторы осторожны',
    neutral: 'Нейтрально - рынок сбалансирован',
    greed: 'Жадность - оптимизм на рынке',
    extremeGreed: 'Экстремальная жадность - берегитесь коррекции',
    source: 'Источник',
    error: 'Не удалось получить индекс. Попробуйте позже.',
    updated: 'Обновлено'
  },
  es: {
    title: 'Crypto Fear & Greed Index',
    description: 'Sentimiento actual del mercado cripto',
    currentValue: 'Valor actual',
    classification: 'Clasificación',
    interpretation: 'Interpretación',
    extremeFear: 'Miedo extremo - posible oportunidad de compra',
    fear: 'Miedo - los inversores son cautelosos',
    neutral: 'Neutral - el mercado está equilibrado',
    greed: 'Codicia - optimismo en el mercado',
    extremeGreed: 'Codicia extrema - atención a una corrección',
    source: 'Fuente',
    error: 'No se pudo obtener el índice ahora. Inténtalo más tarde.',
    updated: 'Actualizado'
  },
  ja: {
    title: 'Crypto Fear & Greed Index',
    description: '暗号資産市場の現在のセンチメント',
    currentValue: '現在値',
    classification: '区分',
    interpretation: '解釈',
    extremeFear: '極度の恐怖 - 買い場の可能性',
    fear: '恐怖 - 投資家は慎重',
    neutral: '中立 - 市場は均衡',
    greed: '強欲 - 市場は楽観的',
    extremeGreed: '極度の強欲 - 調整に注意',
    source: '出典',
    error: '現在、指数を取得できませんでした。後でもう一度お試しください。',
    updated: '更新'
  },
  tr: {
    title: 'Crypto Fear & Greed Index',
    description: 'Kripto piyasasının güncel duyarlılığı',
    currentValue: 'Güncel değer',
    classification: 'Sınıflandırma',
    interpretation: 'Yorum',
    extremeFear: 'Aşırı korku - olası alım fırsatı',
    fear: 'Korku - yatırımcılar temkinli',
    neutral: 'Nötr - piyasa dengeli',
    greed: 'Açgözlülük - piyasada iyimserlik',
    extremeGreed: 'Aşırı açgözlülük - düzeltmeye dikkat',
    source: 'Kaynak',
    error: 'Endeks şu anda alınamadı. Daha sonra tekrar deneyin.',
    updated: 'Güncelleme'
  }};

function langFromLocale(locale) {
  const mapped = LOCALE_MAP[locale] || String(locale || '').slice(0, 2).toLowerCase();
  return LANGS.includes(mapped) ? mapped : 'en';
}

function tr(lang, key) {
  return (S[lang] || S.en)[key] ?? S.en[key] ?? key;
}

let ctx;
let state = {};
let timer = null;
let firstRun = null;
let running = false;
let cache = null;

function level(value) {
  if (value <= 20) return { color: 0xff0000, emoji: '😱', key: 'extremeFear' };
  if (value <= 40) return { color: 0xff6600, emoji: '😰', key: 'fear' };
  if (value <= 60) return { color: 0xffff00, emoji: '😐', key: 'neutral' };
  if (value <= 80) return { color: 0x90ee90, emoji: '😊', key: 'greed' };
  return { color: 0x00ff00, emoji: '🤑', key: 'extremeGreed' };
}

async function fetchIndex() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  try {
    const response = await fetch(API_URL, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const item = json?.data?.[0];
    const value = Number.parseInt(item?.value, 10);
    if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error('unexpected response');
    const data = {
      value,
      classification: String(item.value_classification || '').slice(0, 40),
      timestamp: Number.parseInt(item.timestamp, 10) || Math.floor(Date.now() / 1000)
    };
    cache = { data, at: Date.now() };
    return data;
  } catch (error) {
    ctx?.logger.warn(`could not fetch the index: ${error?.message || error}`);
    return cache?.data || null;
  }
}

function buildEmbed(data, lang) {
  const { color, emoji, key } = level(data.value);
  const filled = Math.round((data.value / 100) * 20);
  const gauge = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return new EmbedBuilder()
    .setTitle(`${emoji} ${tr(lang, 'title')}`)
    .setDescription(tr(lang, 'description'))
    .setColor(color)
    .addFields(
      { name: `📊 ${tr(lang, 'currentValue')}`, value: `**${data.value}/100**\n\`${gauge}\``, inline: false },
      { name: `🏷️ ${tr(lang, 'classification')}`, value: `**${data.classification || '-'}**`, inline: true },
      { name: `💡 ${tr(lang, 'interpretation')}`, value: tr(lang, key), inline: true },
      { name: `📅 ${tr(lang, 'updated')}`, value: `<t:${data.timestamp}:R>`, inline: true }
    )
    .setFooter({ text: `${tr(lang, 'source')}: Alternative.me • ${SITE}` })
    .setTimestamp();
}

function saveState() {
  ctx.writeData(STATE_FILE, state);
}

async function tick() {
  if (running || !ctx || !ctx.client.isReady()) return;
  running = true;
  try {
    const now = Date.now();
    let changed = false;
    for (const guildId of Object.keys(ctx.listGuildSettings())) {
      const settings = ctx.getGuildSettings(guildId);
      if (settings.enabled !== true || !settings.channel) continue;
      const every = Math.max(1, Number(settings.intervalHours) || 24) * 3_600_000;
      if (now - (state[guildId]?.lastSent || 0) < every - 60_000) continue;

      const data = await fetchIndex();
      if (!data) continue;
      try {
        const channel = await ctx.client.channels.fetch(settings.channel);
        if (!channel || !channel.isTextBased?.()) continue;
        await channel.send({ embeds: [buildEmbed(data, settings.language || 'en')] });
        state[guildId] = { lastSent: now };
        changed = true;
      } catch (error) {
        ctx.logger.warn(`could not post to ${guildId}: ${error?.message || error}`);
        state[guildId] = { lastSent: now };
        changed = true;
      }
    }
    if (changed) saveState();
  } catch (error) {
    ctx.logger.error('scheduled post failed', error);
  } finally {
    running = false;
  }
}

const fearGreedCommand = {
  data: new SlashCommandBuilder()
    .setName('feargreed')
    .setDescription('Show the current Crypto Fear & Greed Index'),

  category: 'plugin',
  cooldown: 10,

  execute: async (interaction) => {
    const lang = langFromLocale(interaction.locale);
    await interaction.deferReply();
    const data = await fetchIndex();
    if (!data) {
      return interaction.editReply({ content: tr(lang, 'error') });
    }
    return interaction.editReply({ embeds: [buildEmbed(data, lang)] });
  }
};

const onGuildDelete = {
  name: Events.GuildDelete,
  execute: async (client, guild) => {
    if (!ctx || !state[guild.id]) return;
    delete state[guild.id];
    saveState();
  }
};

export const _internals = { level, buildEmbed, langFromLocale, tr, S, LANGS };

export default {
  name: 'fear_greed',
  version: '1.0.0',
  author: 'Yamiru',
  description: 'Crypto Fear & Greed Index',

  commands: [fearGreedCommand],
  events: [onGuildDelete],

  onLoad: (context) => {
    ctx = context;
    const saved = ctx.readData(STATE_FILE, {});
    state = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    timer = setInterval(() => { tick(); }, TICK_MS);
    timer.unref?.();
    firstRun = setTimeout(() => { tick(); }, 60_000);
    firstRun.unref?.();
  },

  onUnload: () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (firstRun) clearTimeout(firstRun);
    firstRun = null;
    cache = null;
  }
};

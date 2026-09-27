/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  Message,
  MessageFlags
} from 'discord.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { gameAllowed, resolveEconomy } from '../../../../shared/featureConfig.js';
import { formatNumber, randomInt } from '../../../../utils/helpers.js';
import type { Command } from '../../../types.js';
import { suppress } from '../../../../utils/suppress.js';

const SYMBOLS = [
  { icon: '🍒', weight: 30, payout: 2 },
  { icon: '🍋', weight: 25, payout: 3 },
  { icon: '🍇', weight: 20, payout: 4 },
  { icon: '🔔', weight: 13, payout: 6 },
  { icon: '💎', weight: 8, payout: 10 },
  { icon: '7️⃣', weight: 4, payout: 25 }
];

function spinReel() {
  const total = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const symbol of SYMBOLS) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol;
  }
  return SYMBOLS[0];
}

const CARDS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];

function drawCard(): { label: string; value: number } {
  const card = CARDS[randomInt(0, CARDS.length - 1)];
  const suit = SUITS[randomInt(0, SUITS.length - 1)];
  const value = card === 'A' ? 11 : ['J', 'Q', 'K'].includes(card) ? 10 : parseInt(card, 10);
  return { label: `${card}${suit}`, value };
}

function handTotal(hand: { label: string; value: number }[]): number {
  let total = hand.reduce((sum, c) => sum + c.value, 0);
  let aces = hand.filter((c) => c.value === 11).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

const showHand = (hand: { label: string; value: number }[]) =>
  hand.map((c) => `\`${c.label}\``).join(' ');

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('casino')
    .setDescription('Zahraj si o svoje mince')
    .addSubcommand(sub =>
      sub.setName('slots').setDescription('Výherný automat')
        .addIntegerOption(opt => opt.setName('stavka')
          .setDescription('Koľko stavíš').setMinValue(10).setMaxValue(1000000).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('blackjack').setDescription('Blackjack proti krupiérovi')
        .addIntegerOption(opt => opt.setName('stavka')
          .setDescription('Koľko stavíš').setMinValue(10).setMaxValue(1000000).setRequired(true))),

  category: 'economy',
  guildOnly: true,
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const bet = interaction.options.getInteger('stavka', true);

    const settings = await GuildSettings.findOne({ guildId });
    const economy = resolveEconomy(settings);
    const emoji = economy.currencyEmoji;

    if (!gameAllowed(economy, sub)) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription('Táto hazardná hra je na tomto serveri vypnutá.')],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    if (bet < economy.minBet || bet > economy.maxBet) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(`Stávka musí byť medzi ${emoji} **${economy.minBet}** a ${emoji} **${economy.maxBet}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const userData = await UserData.findOne({ odId: userId, guildId });
    const cash = userData?.balance || 0;

    if (cash < bet) {
      await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xed4245)
          .setDescription(`Nemáš dosť hotovosti. Máš ${emoji} **${formatNumber(cash)}**.`)],
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const settle = async (delta: number) => {
      await UserData.findOneAndUpdate(
        { odId: userId, guildId },
        { $inc: { balance: delta } },
        { upsert: true }
      );
    };

    if (sub === 'slots') {
      const reels = [spinReel(), spinReel(), spinReel()];
      const display = reels.map((r) => r.icon).join(' | ');

      let multiplier = 0;
      if (reels[0].icon === reels[1].icon && reels[1].icon === reels[2].icon) {
        multiplier = reels[0].payout;
      } else if (reels[0].icon === reels[1].icon || reels[1].icon === reels[2].icon || reels[0].icon === reels[2].icon) {
        multiplier = 1.5;
      }

      const winnings = Math.floor(bet * multiplier);
      const delta = winnings - bet;
      await settle(delta);

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(delta > 0 ? 0x57f287 : delta === 0 ? 0xfee75c : 0xed4245)
          .setTitle('🎰 Výherný automat')
          .setDescription(`**［ ${display} ］**\n\n` + (
            multiplier === 0
              ? `Nič. Stratil si ${emoji} **${formatNumber(bet)}**.`
              : `Násobok **${multiplier}×** - získal si ${emoji} **${formatNumber(winnings)}** (čistý zisk ${formatNumber(delta)}).`
          ))
          .setFooter({ text: `Zostatok: ${formatNumber(cash + delta)}` })]
      });
      return;
    }

    const player = [drawCard(), drawCard()];
    const dealer = [drawCard(), drawCard()];

    const render = (revealDealer: boolean, note: string, color: number) => new EmbedBuilder()
      .setColor(color)
      .setTitle('🃏 Blackjack')
      .addFields(
        { name: `Ty (${handTotal(player)})`, value: showHand(player), inline: true },
        {
          name: revealDealer ? `Krupiér (${handTotal(dealer)})` : 'Krupiér (?)',
          value: revealDealer ? showHand(dealer) : `\`${dealer[0].label}\` \`??\``,
          inline: true
        }
      )
      .setDescription(note)
      .setFooter({ text: `Stávka: ${formatNumber(bet)}` });

    if (handTotal(player) === 21) {
      const winnings = Math.floor(bet * 1.5);
      await settle(winnings);
      await interaction.reply({
        embeds: [render(true, `Blackjack! Získavaš ${emoji} **${formatNumber(winnings)}**.`, 0x57f287)]
      });
      return;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('bj_hit').setLabel('Ťahať').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('bj_stand').setLabel('Dosť').setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [render(false, 'Ťaháš ďalšiu kartu, alebo končíš?', 0xfee75c)],
      components: [row]
    });

    const panel = (await interaction.fetchReply()) as Message;
    const collector = panel.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60_000
    });

    let finished = false;
    let acting = false;

    const finish = async (button: any, note: string, color: number, delta: number) => {
      finished = true;
      await settle(delta);
      const payload = { embeds: [render(true, note, color)], components: [] };
      if (button) await button.update(payload);
      else await panel.edit(payload).catch(suppress('casino'));
      collector.stop();
    };

    collector.on('collect', async (button) => {
      if (button.user.id !== userId) {
        await button.reply({ content: 'Toto nie je tvoja hra.', flags: MessageFlags.Ephemeral });
        return;
      }

      if (finished || acting) {
        await button.deferUpdate().catch(suppress('casino'));
        return;
      }
      acting = true;

      if (button.customId === 'bj_hit') {
        player.push(drawCard());
        const total = handTotal(player);

        if (total > 21) {
          await finish(button, `Pretiahol si (${total}). Strácaš ${emoji} **${formatNumber(bet)}**.`, 0xed4245, -bet);
          return;
        }
        if (total === 21) {
          await button.update({ embeds: [render(false, 'Máš 21 - krupiér dohráva…', 0xfee75c)], components: [] });
        } else {
          await button.update({ embeds: [render(false, 'Ťaháš ďalej, alebo končíš?', 0xfee75c)], components: [row] });
          acting = false;
          return;
        }
      }

      while (handTotal(dealer) < 17) dealer.push(drawCard());

      const playerTotal = handTotal(player);
      const dealerTotal = handTotal(dealer);

      if (dealerTotal > 21 || playerTotal > dealerTotal) {
        await finish(button.replied || button.deferred ? null : button,
          `Vyhrávaš ${emoji} **${formatNumber(bet)}**.`, 0x57f287, bet);
      } else if (playerTotal === dealerTotal) {
        await finish(button.replied || button.deferred ? null : button,
          'Remíza - stávka sa vracia.', 0xfee75c, 0);
      } else {
        await finish(button.replied || button.deferred ? null : button,
          `Krupiér vyhral. Strácaš ${emoji} **${formatNumber(bet)}**.`, 0xed4245, -bet);
      }
    });

    collector.on('end', async () => {
      if (finished) return;

      const penalty = Math.floor(bet / 2);
      await settle(-penalty);
      await panel.edit({
        embeds: [render(true, `Čas vypršal. Odpísaná polovica stávky: ${emoji} **${formatNumber(penalty)}**.`, 0x949ba4)],
        components: []
      }).catch(suppress('casino'));
    });
  }
};

export default command;

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { listMatches } from '../history/historyStore.js';

export const HISTORY_PREV = 'history_prev';
export const HISTORY_NEXT = 'history_next';

const PAGE_SIZE = 5;

export const data = new SlashCommandBuilder()
  .setName('historico')
  .setDescription('Mostra o histórico de partidas do mix.')
  .addUserOption((opt) =>
    opt
      .setName('jogador')
      .setDescription('Filtra partidas em que esse jogador participou')
      .setRequired(false),
  );

function formatDate(ts) {
  if (!ts) return '-';
  try {
    return new Date(ts).toLocaleString('pt-BR', { hour12: false });
  } catch {
    return new Date(ts).toISOString();
  }
}

/**
 * @param {string} guildId
 * @param {string | null} userId
 * @param {number} page
 * @param {string | null} requesterId
 */
function buildPayload(guildId, userId, page, requesterId) {
  const offset = page * PAGE_SIZE;
  const { matches, total } = listMatches(guildId, {
    userId: userId ?? undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const title = userId
    ? `📜 Histórico — partidas de <@${userId}>`
    : '📜 Histórico de partidas';

  const description = (() => {
    if (!matches.length) return '_Sem partidas registradas._';
    return matches
      .map((m, i) => {
        const idx = offset + i + 1;
        const dt = formatDate(m.finishedAt ?? m.startedAt);
        const r = m.result;
        const score = r ? `${r.mapsA} x ${r.mapsB}` : '— (pendente)';
        const winner = r ? `🥇 Time ${r.winner}` : '⏳ aguardando /win';
        const decider = m.decider ?? '-';
        return [
          `**#${idx}** · ${dt}`,
          `🔵 Time A ${score} Time B 🔴 · ${winner}`,
          `🧢 <@${m.captainA}> vs <@${m.captainB}> · 🟣 Decider: \`${decider}\``,
        ].join('\n');
      })
      .join('\n\n');
  })();

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: `Página ${safePage + 1}/${totalPages} · ${total} partida(s)` });

  const baseId = userId ? `u:${userId}` : 'g';
  const reqSuffix = requesterId ? `:r:${requesterId}` : '';
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${HISTORY_PREV}:${baseId}:${safePage}${reqSuffix}`)
      .setLabel('◀ Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage <= 0),
    new ButtonBuilder()
      .setCustomId(`${HISTORY_NEXT}:${baseId}:${safePage}${reqSuffix}`)
      .setLabel('Próxima ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(safePage >= totalPages - 1),
  );

  return {
    embeds: [embed],
    components: total > PAGE_SIZE ? [row] : [],
  };
}

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Usa este comando dentro de um servidor.',
    });
    return;
  }
  const user = interaction.options.getUser('jogador');
  const payload = buildPayload(
    interaction.guildId,
    user?.id ?? null,
    0,
    interaction.user.id,
  );
  await interaction.reply({
    ...payload,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleHistoryButton(interaction) {
  if (!interaction.guildId) return;
  const raw = String(interaction.customId);
  const isPrev = raw.startsWith(`${HISTORY_PREV}:`);
  const isNext = raw.startsWith(`${HISTORY_NEXT}:`);
  if (!isPrev && !isNext) return;

  // Formato: <action>:<g | u:USERID>:<page>[:r:<requesterId>]
  const rest = raw.slice((isPrev ? HISTORY_PREV : HISTORY_NEXT).length + 1);
  let userId = null;
  let pageStr = '';
  let requesterId = null;

  if (rest.startsWith('u:')) {
    const after = rest.slice(2);
    const colon = after.indexOf(':');
    userId = colon === -1 ? after : after.slice(0, colon);
    const remaining = colon === -1 ? '' : after.slice(colon + 1);
    const rParts = remaining.split(':r:');
    pageStr = rParts[0] ?? '';
    requesterId = rParts[1] ?? null;
  } else if (rest.startsWith('g:')) {
    const after = rest.slice(2);
    const rParts = after.split(':r:');
    pageStr = rParts[0] ?? '';
    requesterId = rParts[1] ?? null;
  }

  const currentPage = parseInt(pageStr, 10);
  if (!Number.isFinite(currentPage)) return;

  if (requesterId && requesterId !== interaction.user.id) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Só quem abriu o histórico pode navegar (abre o teu com `/historico`).',
    });
    return;
  }

  const nextPage = isPrev ? currentPage - 1 : currentPage + 1;
  const payload = buildPayload(
    interaction.guildId,
    userId,
    Math.max(0, nextPage),
    requesterId,
  );
  await interaction.update(payload);
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { getMatch, setMatch } from './matchStore.js';

export const MAP_VETO_PREFIX = 'mapveto';

function now() {
  return Date.now();
}

function parsePool() {
  const raw = String(process.env.MIX_MAP_POOL || '').trim();
  const pool = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['de_mirage', 'de_inferno', 'de_nuke', 'de_ancient', 'de_anubis', 'de_vertigo', 'de_dust2'];
  // remove duplicados
  return [...new Set(pool)];
}

/**
 * BO3: A ban, B ban, A pick, B pick, A ban, B ban, sobra 1 (decider)
 */
const STEPS = /** @type {{ kind: 'ban'|'pick'; team: 'A'|'B' }[]} */ ([
  { kind: 'ban', team: 'A' },
  { kind: 'ban', team: 'B' },
  { kind: 'pick', team: 'A' },
  { kind: 'pick', team: 'B' },
  { kind: 'ban', team: 'A' },
  { kind: 'ban', team: 'B' },
]);

function stepLabel(step) {
  const s = STEPS[step];
  if (!s) return 'Finalizando…';
  const team = s.team === 'A' ? '🔵 Time A' : '🔴 Time B';
  const kind = s.kind === 'ban' ? 'BAN' : 'PICK';
  return `${team} — ${kind}`;
}

function buildVetoEmbed(match) {
  const veto = match.veto;
  const actions = veto?.actions ?? [];
  const remaining = veto?.remaining ?? [];
  const step = veto?.step ?? 0;

  const history =
    actions.length === 0
      ? '_Nenhuma ação ainda._'
      : actions
          .map((a, i) => {
            const t = a.team === 'A' ? 'A' : 'B';
            const k = a.kind.toUpperCase();
            return `**${i + 1}.** ${t} ${k}: \`${a.map}\``;
          })
          .join('\n');

  return new EmbedBuilder()
    .setTitle('🗺️ Veto de mapas (BO3)')
    .setDescription(
      `**Turno:** ${stepLabel(step)}\n\n` +
        `**Mapas restantes (${remaining.length}):**\n${remaining.map((m) => `- \`${m}\``).join('\n')}\n\n` +
        `**Histórico:**\n${history}`,
    )
    .setFooter({ text: 'Somente o capitão do turno pode clicar.' });
}

function buildMapButtons(remaining) {
  /** @type {ActionRowBuilder<ButtonBuilder>[]} */
  const rows = [];
  let row = new ActionRowBuilder();
  for (let i = 0; i < remaining.length; i++) {
    const map = remaining[i];
    const btn = new ButtonBuilder()
      .setCustomId(`${MAP_VETO_PREFIX}:${encodeURIComponent(map)}`)
      .setLabel(map.slice(0, 80))
      .setStyle(ButtonStyle.Primary);
    row.addComponents(btn);
    if ((i + 1) % 5 === 0 || i === remaining.length - 1) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  }
  return rows;
}

export function initVetoForMatch(match) {
  const pool = parsePool();
  match.veto = {
    messageId: null,
    pool,
    remaining: [...pool],
    actions: [],
    step: 0,
  };
}

/**
 * @param {import('discord.js').TextBasedChannel} channel
 * @param {string} guildId
 */
export async function postOrUpdateVetoMessage(channel, guildId) {
  const match = getMatch(guildId);
  if (!match || match.phase !== 'map_veto') return null;
  if (!match.veto) initVetoForMatch(match);

  const veto = match.veto;
  const payload = {
    embeds: [buildVetoEmbed(match)],
    components: buildMapButtons(veto.remaining),
  };

  if (veto.messageId) {
    const msg = await channel.messages.fetch(veto.messageId).catch(() => null);
    if (msg) {
      await msg.edit(payload).catch(() => {});
      setMatch(guildId, match);
      return msg;
    }
  }

  const msg = await channel.send(payload);
  veto.messageId = msg.id;
  setMatch(guildId, match);
  return msg;
}

function currentStep(match) {
  const veto = match.veto;
  const step = veto?.step ?? 0;
  return STEPS[step] ?? null;
}

function captainForTeam(match, team) {
  const v = match.vote;
  if (!v) return null;
  return team === 'A' ? v.captainA : v.captainB;
}

function finalizeIfDone(match) {
  const veto = match.veto;
  if (!veto) return { done: false };
  if (veto.step < STEPS.length) return { done: false };
  // após 6 ações, deve sobrar 1 mapa
  const remaining = veto.remaining;
  const decider = remaining[0] ?? null;
  const picks = veto.actions.filter((a) => a.kind === 'pick');
  const pickA = picks.find((p) => p.team === 'A')?.map ?? null;
  const pickB = picks.find((p) => p.team === 'B')?.map ?? null;
  return { done: true, pickA, pickB, decider };
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleMapVetoButton(interaction) {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) return;
  const parts = String(interaction.customId).split(':');
  if (parts.length !== 2 || parts[0] !== MAP_VETO_PREFIX) return;
  const map = decodeURIComponent(parts[1] || '');
  const guildId = interaction.guildId;

  const match = getMatch(guildId);
  if (!match || match.phase !== 'map_veto') {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Não existe veto ativo agora.',
    });
    return;
  }
  if (!match.veto) initVetoForMatch(match);

  const step = currentStep(match);
  if (!step) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Veto já foi finalizado.',
    });
    return;
  }

  const captain = captainForTeam(match, step.team);
  if (!captain) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Capitães ainda não foram definidos.',
    });
    return;
  }
  if (interaction.user.id !== captain) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Não é o teu turno. Só o capitão do turno pode clicar.',
    });
    return;
  }

  const veto = match.veto;
  if (!veto.remaining.includes(map)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Esse mapa não está mais disponível.',
    });
    return;
  }

  await interaction.deferUpdate();

  veto.actions.push({
    kind: step.kind,
    team: step.team,
    map,
    by: interaction.user.id,
    at: now(),
  });

  if (step.kind === 'ban') {
    veto.remaining = veto.remaining.filter((m) => m !== map);
  } else {
    // pick: mantém (mas marca no histórico); não remove pra não sumir de "restantes"?
    // em BO3 clássico, o pick continua "não banido"; porém pra UI, removemos pra evitar cliques repetidos.
    veto.remaining = veto.remaining.filter((m) => m !== map);
  }

  veto.step += 1;

  const done = finalizeIfDone(match);
  if (done.done) {
    match.phase = 'done';
  }

  setMatch(guildId, match);

  await postOrUpdateVetoMessage(interaction.channel, guildId);

  if (done.done) {
    const msg =
      `✅ **Veto BO3 finalizado**\n` +
      `🔵 Pick Time A: **${done.pickA ?? '-'}**\n` +
      `🔴 Pick Time B: **${done.pickB ?? '-'}**\n` +
      `🟣 Decider: **${done.decider ?? '-'}**`;
    await interaction.channel.send({ content: msg });
  }
}


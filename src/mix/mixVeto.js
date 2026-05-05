import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { readMapPool } from './mapPool.js';
import { getSession, setSession } from './mixSession.js';
import { formatVoiceMoveSummary, moveTeamsToVoice } from './mixVoiceMove.js';

export const VETO_PREFIX = 'mix_veto';

// BO3 sequência do plano
const BO3_SEQUENCE = [
  { team: 'A', action: 'ban' },
  { team: 'B', action: 'ban' },
  { team: 'A', action: 'pick' },
  { team: 'B', action: 'pick' },
  { team: 'A', action: 'ban' },
  { team: 'B', action: 'ban' },
];

function now() {
  return Date.now();
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)] ?? null;
}

function buildEmbed(session) {
  const step = session.veto?.step ?? 0;
  const seq = BO3_SEQUENCE[step] ?? null;
  const teamLabel = seq?.team === 'A' ? '🔵 Time A' : seq?.team === 'B' ? '🔴 Time B' : '—';
  const actionLabel = seq?.action ? seq.action.toUpperCase() : 'FINAL';

  const mapsLeft = session.veto?.mapsLeft ?? [];
  const bans = session.veto?.bans ?? [];
  const picks = session.veto?.picks ?? {};

  const lines = [
    `**Turno:** ${teamLabel} — **${actionLabel}**`,
    '',
    `**Picks:**`,
    `- A: ${picks.A ? `\`${picks.A}\`` : '-'}`,
    `- B: ${picks.B ? `\`${picks.B}\`` : '-'}`,
    '',
    `**Bans (${bans.length}):** ${bans.length ? bans.map((m) => `\`${m}\``).join(', ') : '-'}`,
    '',
    `**Mapas restantes (${mapsLeft.length}):**`,
    mapsLeft.map((m) => `- \`${m}\``).join('\n') || '-',
  ];

  return new EmbedBuilder()
    .setTitle('🗺️ Veto BO3')
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Somente o capitão do turno pode clicar. Timeout = aleatório.' });
}

function buildButtons(mapsLeft) {
  /** @type {ActionRowBuilder<ButtonBuilder>[]} */
  const rows = [];
  let row = new ActionRowBuilder();
  for (let i = 0; i < mapsLeft.length; i++) {
    const map = mapsLeft[i];
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${VETO_PREFIX}_${encodeURIComponent(map)}`)
        .setLabel(map.slice(0, 80))
        .setStyle(ButtonStyle.Primary),
    );
    if ((i + 1) % 5 === 0 || i === mapsLeft.length - 1) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  }
  return rows;
}

function ensureVeto(session) {
  if (!session.veto) {
    const pool = readMapPool();
    session.veto = {
      step: 0,
      mapsLeft: [...pool],
      picks: {},
      bans: [],
    };
  }
  return session.veto;
}

function deadlineMs() {
  const ms = parseInt(String(process.env.MIX_VETO_PICK_MS || '30000'), 10);
  return Number.isFinite(ms) && ms >= 5000 ? ms : 30000;
}

function captainId(session, team) {
  return team === 'A' ? session.captains.A : session.captains.B;
}

export async function startVetoOrUpdateMessage(channel, guildId) {
  const session = getSession(guildId);
  if (!session || session.phase !== 'veto') return null;
  const veto = ensureVeto(session);
  session.vetoDeadlineAt = now() + deadlineMs();
  setSession(guildId, session);

  return await channel.send({
    embeds: [buildEmbed(session)],
    components: buildButtons(veto.mapsLeft),
  });
}

function applyChoice(session, map) {
  const veto = ensureVeto(session);
  const step = veto.step;
  const seq = BO3_SEQUENCE[step] ?? null;
  if (!seq) return { done: true };

  if (!veto.mapsLeft.includes(map)) return { ok: false, reason: 'not_available' };

  if (seq.action === 'ban') {
    veto.bans.push(map);
    veto.mapsLeft = veto.mapsLeft.filter((m) => m !== map);
  } else {
    veto.picks[seq.team] = map;
    veto.mapsLeft = veto.mapsLeft.filter((m) => m !== map);
  }

  veto.step += 1;
  veto.lastActionAt = now();

  if (veto.step >= BO3_SEQUENCE.length) {
    veto.decider = veto.mapsLeft[0] ?? undefined;
    session.phase = 'done';
    return { done: true };
  }
  session.vetoDeadlineAt = now() + deadlineMs();
  return { done: false };
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleVetoButton(interaction) {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) return;
  const raw = String(interaction.customId);
  if (!raw.startsWith(`${VETO_PREFIX}_`)) return;
  const parts = raw.split('_');
  if (parts.length !== 3) return;
  const map = decodeURIComponent(parts[2] || '');

  const session = getSession(interaction.guildId);
  if (!session || session.phase !== 'veto') {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'Não existe veto ativo agora.' });
    return;
  }

  const veto = ensureVeto(session);
  const seq = BO3_SEQUENCE[veto.step] ?? null;
  if (!seq) {
    await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'Veto já foi finalizado.' });
    return;
  }

  const captain = captainId(session, seq.team);
  if (!captain || interaction.user.id !== captain) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Não é o teu turno. Só o capitão do turno pode clicar.',
    });
    return;
  }

  await interaction.deferUpdate();

  const res = applyChoice(session, map);
  if (res.ok === false) {
    await interaction.followUp({ flags: MessageFlags.Ephemeral, content: 'Mapa inválido/indisponível.' }).catch(() => {});
    return;
  }
  setSession(interaction.guildId, session);

  await interaction.channel.send({
    embeds: [buildEmbed(session)],
    components: session.phase === 'done' ? [] : buildButtons(veto.mapsLeft),
  });

  if (session.phase === 'done') {
    const decider = veto.decider ?? '-';
    await interaction.channel.send({
      content:
        `✅ **Veto BO3 finalizado**\n` +
        `🔵 Pick Time A: **${veto.picks.A ?? '-'}**\n` +
        `🔴 Pick Time B: **${veto.picks.B ?? '-'}**\n` +
        `🟣 Decider: **${decider}**`,
    });

    const guild = interaction.guild;
    if (guild) {
      const voiceResult = await moveTeamsToVoice(guild, session.teamA, session.teamB);
      const summary = formatVoiceMoveSummary(voiceResult);
      if (summary) {
        await interaction.channel.send({
          content: summary,
          allowedMentions: { users: [...session.teamA, ...session.teamB] },
        });
      }
    }
  }
}


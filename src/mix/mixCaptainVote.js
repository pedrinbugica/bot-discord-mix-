import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { getSession, setSession } from './mixSession.js';
import { startVetoOrUpdateMessage } from './mixVeto.js';
import { addCleanup } from './mixCleanup.js';

export const VOTE_PREFIX = 'mix_vote';

function now() {
  return Date.now();
}

/**
 * @param {string[]} team
 * @param {Record<string, string>} votes voterId -> candidateId
 * @returns {Record<string, number>} candidateId -> count
 */
function tally(team, votes) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const uid of team) counts[uid] = 0;
  for (const [voter, candidate] of Object.entries(votes)) {
    if (!team.includes(voter)) continue;
    if (!team.includes(candidate)) continue;
    counts[candidate] = (counts[candidate] ?? 0) + 1;
  }
  return counts;
}

/**
 * @param {string[]} team
 * @param {Record<string, number>} counts
 */
function pickWinner(team, counts) {
  let best = -1;
  /** @type {string[]} */
  let top = [];
  for (const uid of team) {
    const c = counts[uid] ?? 0;
    if (c > best) {
      best = c;
      top = [uid];
    } else if (c === best) {
      top.push(uid);
    }
  }
  if (!top.length) return team[Math.floor(Math.random() * team.length)] ?? null;
  return top[Math.floor(Math.random() * top.length)] ?? null;
}

/**
 * @param {string} teamLabel
 * @param {string[]} team
 * @param {Record<string, string>} votes
 * @param {number} deadlineAt
 */
function buildVoteEmbed(teamLabel, team, votes, deadlineAt) {
  const counts = tally(team, votes);
  const lines = team.map((uid) => {
    const c = counts[uid] ?? 0;
    return `- <@${uid}> — **${c}** voto(s)`;
  });
  const remainingMs = Math.max(0, deadlineAt - now());
  const remainingSec = Math.ceil(remainingMs / 1000);
  return new EmbedBuilder()
    .setTitle(`🧢 Votação de capitão — Time ${teamLabel}`)
    .setDescription(
      `${lines.join('\n')}\n\n⏳ Tempo restante: **${remainingSec}s**\n\nClica no nome do jogador para votar.`,
    )
    .setFooter({ text: 'Capitão do time será o mais votado (empate = sorteio).' });
}

/**
 * @param {string} teamKey 'A'|'B'
 * @param {string[]} team
 */
async function buildVoteButtons(guild, teamKey, team) {
  /** @type {ActionRowBuilder<ButtonBuilder>[]} */
  const rows = [];
  let row = new ActionRowBuilder();
  for (let i = 0; i < team.length; i++) {
    const uid = team[i];
    const m = guild ? await guild.members.fetch(uid).catch(() => null) : null;
    const label = (m?.user?.username ?? `@${uid}`).slice(0, 80);
    const btn = new ButtonBuilder()
      .setCustomId(`${VOTE_PREFIX}_${teamKey}_${uid}`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary);
    row.addComponents(btn);
    if ((i + 1) % 5 === 0 || i === team.length - 1) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  }
  return rows;
}

/**
 * @param {import('discord.js').TextBasedChannel} channel
 * @param {{ teamA: string[]; teamB: string[] }} teams
 * @returns {Promise<{ messageAId: string; messageBId: string; deadlineAt: number }>}
 */
export async function startCaptainVote(channel, teams) {
  const guild = channel.guild ?? null;
  const timeoutMs = Math.max(
    10_000,
    parseInt(String(process.env.MIX_CAPTAIN_VOTE_MS || '30000'), 10) || 30000,
  );
  const deadlineAt = now() + timeoutMs;

  const msgA = await channel.send({
    embeds: [buildVoteEmbed('A', teams.teamA, {}, deadlineAt)],
    components: await buildVoteButtons(guild, 'A', teams.teamA),
  });
  const msgB = await channel.send({
    embeds: [buildVoteEmbed('B', teams.teamB, {}, deadlineAt)],
    components: await buildVoteButtons(guild, 'B', teams.teamB),
  });

  return { messageAId: msgA.id, messageBId: msgB.id, deadlineAt };
}

function isMember(team, userId) {
  return team.includes(userId);
}

function voteState(match) {
  if (!match.vote) {
    match.vote = {
      messageAId: null,
      messageBId: null,
      votesA: {},
      votesB: {},
      deadlineAt: now() + 60_000,
      captainA: null,
      captainB: null,
    };
  }
  return match.vote;
}

/**
 * Finaliza capitães se já expirou ou todo mundo votou.
 * @returns {{ changed: boolean; captainA: string | null; captainB: string | null }}
 */
function maybeFinalizeCaptains(match) {
  const v = voteState(match);

  const aVoted = new Set(Object.keys(v.votesA).filter((uid) => match.teams.teamA.includes(uid)));
  const bVoted = new Set(Object.keys(v.votesB).filter((uid) => match.teams.teamB.includes(uid)));
  const allA = aVoted.size >= match.teams.teamA.length;
  const allB = bVoted.size >= match.teams.teamB.length;
  const expired = now() >= v.deadlineAt;

  let changed = false;
  if (!v.captainA && (allA || expired)) {
    const countsA = tally(match.teams.teamA, v.votesA);
    v.captainA = pickWinner(match.teams.teamA, countsA);
    changed = true;
  }
  if (!v.captainB && (allB || expired)) {
    const countsB = tally(match.teams.teamB, v.votesB);
    v.captainB = pickWinner(match.teams.teamB, countsB);
    changed = true;
  }
  return { changed, captainA: v.captainA, captainB: v.captainB };
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleCaptainVoteButton(interaction) {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) return;

  const raw = String(interaction.customId);
  if (!raw.startsWith(`${VOTE_PREFIX}_`)) return;
  const parts = raw.split('_');
  // mix_vote_A_<userId>
  if (parts.length !== 4) return;
  const teamKey = parts[2];
  const candidateId = parts[3];
  const voterId = interaction.user.id;

  const session = getSession(interaction.guildId);
  if (!session || session.phase !== 'voting') {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Não existe uma votação ativa agora.',
    });
    return;
  }

  const team = teamKey === 'A' ? session.teamA : teamKey === 'B' ? session.teamB : null;
  if (!team) return;

  if (!isMember(team, voterId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Só quem está nesse time pode votar aqui.',
    });
    return;
  }
  if (!isMember(team, candidateId)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Esse jogador não está nesse time.',
    });
    return;
  }

  await interaction.deferUpdate();

  if (teamKey === 'A') session.votes.A.set(voterId, candidateId);
  else session.votes.B.set(voterId, candidateId);

  const deadlineAt = session.voteDeadlineAt ?? (now() + 30_000);
  const vA = Object.fromEntries(session.votes.A.entries());
  const vB = Object.fromEntries(session.votes.B.entries());
  const countsA = tally(session.teamA, vA);
  const countsB = tally(session.teamB, vB);

  const allA = session.votes.A.size >= session.teamA.length;
  const allB = session.votes.B.size >= session.teamB.length;
  const expired = now() >= deadlineAt;

  if (!session.captains.A && (allA || expired)) session.captains.A = pickWinner(session.teamA, countsA);
  if (!session.captains.B && (allB || expired)) session.captains.B = pickWinner(session.teamB, countsB);

  setSession(interaction.guildId, session);

  // Atualiza as duas mensagens da votação (se existirem)
  const ch = interaction.channel;
  const refresh = async (messageId, label, teamIds, votesObj) => {
    if (!messageId) return;
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (!msg) return;
    const guild = interaction.guild;
    await msg
      .edit({
        embeds: [buildVoteEmbed(label, teamIds, votesObj, deadlineAt)],
        components: await buildVoteButtons(guild, label, teamIds),
      })
      .catch(() => {});
  };

  // best-effort: tenta atualizar a própria mensagem clicada e a outra, se existirem no canal
  // Atualiza a mensagem clicada (e a outra do mesmo canal, se existir)
  await refresh(interaction.message.id, teamKey, team, teamKey === 'A' ? vA : vB);
  const otherMessageId =
    teamKey === 'A' ? session.voteMessageBId : teamKey === 'B' ? session.voteMessageAId : null;
  if (otherMessageId) {
    const otherTeam = teamKey === 'A' ? session.teamB : session.teamA;
    const otherVotes = teamKey === 'A' ? vB : vA;
    await refresh(otherMessageId, teamKey === 'A' ? 'B' : 'A', otherTeam, otherVotes);
  }

  if (session.captains.A && session.captains.B && session.phase === 'voting') {
    session.phase = 'veto';
    setSession(interaction.guildId, session);
    const captainsMsg = await ch.send({
      content: `🧢 Capitães definidos!\n🔵 Time A: <@${session.captains.A}>\n🔴 Time B: <@${session.captains.B}>`,
      allowedMentions: { users: [session.captains.A, session.captains.B] },
    });
    addCleanup(session, ch.id, captainsMsg.id);
    setSession(interaction.guildId, session);
    await startVetoOrUpdateMessage(ch, interaction.guildId);
  }
}


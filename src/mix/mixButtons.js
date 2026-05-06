import { MessageFlags } from 'discord.js';
import {
  clearPanel,
  clearUsers,
  getUserIds,
  joinQueue,
  leaveQueue,
} from '../queue/mixQueue.js';
import { buildPanelContent, MIX_JOIN_ID, MIX_LEAVE_ID } from './mixPanel.js';
import { announceAllowedMentions, buildFullMixMessage } from './mixNotify.js';
import { splitMixTeams } from './mixTeamSplit.js';
import { resolveGuild } from './resolveGuild.js';
import { startCaptainVote } from './mixCaptainVote.js';
import { clearSession, getSession, setSession } from './mixSession.js';
import { addCleanup } from './mixCleanup.js';

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').MessageEditOptions} payload
 */
async function editPanelMessage(interaction, payload) {
  const guildId = interaction.guildId;
  try {
    await interaction.message.edit(payload);
  } catch (e) {
    if (e && typeof e === 'object' && 'code' in e && e.code === 10008 && guildId) {
      clearPanel(guildId);
    }
    throw e;
  }
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleMixButton(interaction) {
  if (!interaction.guildId || !interaction.channel?.isTextBased()) return;

  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  await interaction.deferUpdate();

  const guild = resolveGuild(interaction.client, guildId, interaction.guild);

  if (interaction.customId === MIX_JOIN_ID) {
    const lobbyId = process.env.MIX_VOICE_LOBBY_ID?.trim();
    const alreadyQueued = getUserIds(guildId).includes(userId);

    if (!alreadyQueued && lobbyId && guild) {
      const member = await guild.members.fetch(userId).catch(() => null);
      const voiceId = member?.voice?.channelId ?? null;
      if (voiceId !== lobbyId) {
        const payload = await buildPanelContent(guild, getUserIds(guildId));
        await editPanelMessage(interaction, payload);
        await interaction.followUp({
          flags: MessageFlags.Ephemeral,
          content: `🔊 Entra neste canal de **lobby** e volta a clicar em **Entrar:** <#${lobbyId}>`,
        });
        return;
      }
    }

    const result = joinQueue(guildId, userId);
    if (result.status === 'already' || result.status === 'full') {
      const payload = await buildPanelContent(guild, getUserIds(guildId));
      await editPanelMessage(interaction, payload);
      const tip =
        result.status === 'already'
          ? 'Já estás na fila.'
          : 'A fila está cheia. Espera até ao próximo mix.';
      await interaction.followUp({
        flags: MessageFlags.Ephemeral,
        content: tip,
      });
      return;
    }

    if (result.full) {
      const snapshot = getUserIds(guildId);
      const panelFull = await buildPanelContent(guild, snapshot);
      await editPanelMessage(interaction, panelFull);

      const delayRaw = process.env.MIX_QUEUE_FULL_DELAY_MS ?? '3000';
      const delayMs = parseInt(String(delayRaw).trim(), 10);
      const waitMs =
        Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 3000;
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }

      const content = buildFullMixMessage(snapshot);
      const fullMixMsg = await interaction.channel.send({
        content,
        allowedMentions: announceAllowedMentions(snapshot),
      });

      // Inicia fluxo do mix: sorteio de times -> votação de capitão -> veto BO3
      clearSession(guildId);
      const { teamA, teamB } = splitMixTeams(snapshot);
      const voteMeta = await startCaptainVote(interaction.channel, {
        teamA,
        teamB,
      });
      setSession(guildId, {
        phase: 'voting',
        teamA,
        teamB,
        votes: { A: new Map(), B: new Map() },
        captains: {},
        panelChannelId: interaction.channelId,
        voteDeadlineAt: voteMeta.deadlineAt,
        voteMessageAId: voteMeta.messageAId,
        voteMessageBId: voteMeta.messageBId,
        cleanupMessages: [],
        startedAt: Date.now(),
      });
      const teamsMsg = await interaction.channel.send({
        content:
          `👥 **Times sorteados**\n` +
          `🔵 **Time A:** ${teamA.map((id) => `<@${id}>`).join(' ')}\n` +
          `🔴 **Time B:** ${teamB.map((id) => `<@${id}>`).join(' ')}\n\n` +
          `🧢 Agora abre a **votação de capitão** (uma por time).`,
        allowedMentions: { users: snapshot },
      });

      const session = getSession(guildId);
      if (session) {
        addCleanup(session, interaction.channelId, fullMixMsg.id);
        addCleanup(session, interaction.channelId, voteMeta.messageAId);
        addCleanup(session, interaction.channelId, voteMeta.messageBId);
        addCleanup(session, interaction.channelId, teamsMsg.id);
        setSession(guildId, session);
      }

      clearUsers(guildId);
    }

    const payload = await buildPanelContent(guild, getUserIds(guildId));
    await editPanelMessage(interaction, payload);
    return;
  }

  if (interaction.customId === MIX_LEAVE_ID) {
    leaveQueue(guildId, userId);
    const payload = await buildPanelContent(guild, getUserIds(guildId));
    await editPanelMessage(interaction, payload);
  }
}

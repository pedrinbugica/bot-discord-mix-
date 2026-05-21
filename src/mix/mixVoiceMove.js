import { ChannelType } from 'discord.js';
import { splitMixTeams } from './mixTeamSplit.js';
import { resolveVoiceLobbyId, resolveVoiceTeamIds } from '../store/guildConfig.js';

function humanMoveError(err) {
  const code = err && typeof err === 'object' && 'code' in err ? err.code : null;
  const msg = String(err?.message ?? err ?? 'erro');
  if (code === 40032) return 'não está em canal de voz (entra num lobby de voz antes do mix).';
  if (code === 50013) return 'sem permissão (o bot precisa de Mover membros / Ligar nos canais).';
  if (code === 10003) return 'canal de voz inválido ou inacessível.';
  if (/Unknown Channel/i.test(msg)) return 'canal não encontrado.';
  if (/Missing Permissions/i.test(msg)) return 'sem permissão.';
  if (/not connected/i.test(msg)) return 'não está em voz.';
  return msg.length > 120 ? `${msg.slice(0, 117)}…` : msg;
}

/**
 * @param {import('discord.js').Guild} guild
 * @param {string[]} userIds — quando cheios, tamanho = MIX_QUEUE_MAX (ex.: 2 ou 10)
 * @returns {Promise<{
 *   ok: boolean;
 *   reason?: string;
 *   teamA?: string[];
 *   teamB?: string[];
 *   channelAName?: string;
 *   channelBName?: string;
 *   moved?: { userId: string; team: 'A' | 'B' }[];
 *   failed?: { userId: string; reason: string }[];
 * }>}
 */
export async function moveMixTeams(guild, userIds, guildId = null) {
  const { teamAId: idA, teamBId: idB } = resolveVoiceTeamIds(guildId ?? guild?.id ?? null);

  if (!idA || !idB) {
    return {
      ok: false,
      reason: 'missing_channels',
    };
  }

  const { teamA, teamB } = splitMixTeams(userIds);

  /** @type {import('discord.js').VoiceChannel | null} */
  let chA;
  /** @type {import('discord.js').VoiceChannel | null} */
  let chB;
  try {
    const rawA = await guild.channels.fetch(idA).catch(() => null);
    const rawB = await guild.channels.fetch(idB).catch(() => null);
    chA = rawA?.type === ChannelType.GuildVoice ? /** @type {import('discord.js').VoiceChannel} */ (rawA) : null;
    chB = rawB?.type === ChannelType.GuildVoice ? /** @type {import('discord.js').VoiceChannel} */ (rawB) : null;
  } catch {
    return { ok: false, reason: 'fetch_channels' };
  }

  if (!chA || !chB) {
    return { ok: false, reason: 'invalid_channels' };
  }

  const lobbyId = resolveVoiceLobbyId(guildId ?? guild?.id ?? null);

  /** @type {{ userId: string; team: 'A' | 'B' }[]} */
  const moved = [];
  /** @type {{ userId: string; reason: string }[]} */
  const failed = [];

  /**
   * @param {string} uid
   * @param {'A' | 'B'} team
   * @param {import('discord.js').VoiceChannel} channel
   */
  async function tryOne(uid, team, channel) {
    try {
      const member = await guild.members.fetch(uid);
      if (lobbyId && member.voice.channelId !== lobbyId) {
        failed.push({ userId: uid, reason: 'não está no lobby de voz' });
        return;
      }
      await member.voice.setChannel(channel);
      moved.push({ userId: uid, team });
    } catch (e) {
      failed.push({ userId: uid, reason: humanMoveError(e) });
    }
  }

  for (const uid of teamA) {
    await tryOne(uid, 'A', chA);
  }
  for (const uid of teamB) {
    await tryOne(uid, 'B', chB);
  }

  return {
    ok: true,
    teamA,
    teamB,
    channelAName: chA.name,
    channelBName: chB.name,
    moved,
    failed,
  };
}

/**
 * Move times já definidos para voz (reutilizável pelo fluxo pós-veto).
 * @param {import('discord.js').Guild} guild
 * @param {string[]} teamA
 * @param {string[]} teamB
 * @param {string | null} [guildId]
 */
export async function moveTeamsToVoice(guild, teamA, teamB, guildId = null) {
  const { teamAId: idA, teamBId: idB } = resolveVoiceTeamIds(guildId ?? guild?.id ?? null);

  if (!idA || !idB) {
    return {
      ok: false,
      reason: 'missing_channels',
    };
  }

  /** @type {import('discord.js').VoiceChannel | null} */
  let chA;
  /** @type {import('discord.js').VoiceChannel | null} */
  let chB;
  try {
    const rawA = await guild.channels.fetch(idA).catch(() => null);
    const rawB = await guild.channels.fetch(idB).catch(() => null);
    chA = rawA?.type === ChannelType.GuildVoice ? /** @type {import('discord.js').VoiceChannel} */ (rawA) : null;
    chB = rawB?.type === ChannelType.GuildVoice ? /** @type {import('discord.js').VoiceChannel} */ (rawB) : null;
  } catch {
    return { ok: false, reason: 'fetch_channels' };
  }

  if (!chA || !chB) {
    return { ok: false, reason: 'invalid_channels' };
  }

  const lobbyId = resolveVoiceLobbyId(guildId ?? guild?.id ?? null);

  /** @type {{ userId: string; team: 'A' | 'B' }[]} */
  const moved = [];
  /** @type {{ userId: string; reason: string }[]} */
  const failed = [];

  /**
   * @param {string} uid
   * @param {'A' | 'B'} team
   * @param {import('discord.js').VoiceChannel} channel
   */
  async function tryOne(uid, team, channel) {
    try {
      const member = await guild.members.fetch(uid);
      if (lobbyId && member.voice.channelId !== lobbyId) {
        failed.push({ userId: uid, reason: 'não está no lobby de voz' });
        return;
      }
      await member.voice.setChannel(channel);
      moved.push({ userId: uid, team });
    } catch (e) {
      failed.push({ userId: uid, reason: humanMoveError(e) });
    }
  }

  for (const uid of teamA) {
    await tryOne(uid, 'A', chA);
  }
  for (const uid of teamB) {
    await tryOne(uid, 'B', chB);
  }

  return {
    ok: true,
    teamA,
    teamB,
    channelAName: chA.name,
    channelBName: chB.name,
    moved,
    failed,
  };
}

/**
 * @param {Awaited<ReturnType<typeof moveMixTeams>>} result
 * @returns {string | null} — null = não enviar mensagem extra
 */
export function formatVoiceMoveSummary(result) {
  if (!result.ok) {
    if (result.reason === 'missing_channels') {
      return '🔧 **Voz:** define `MIX_VOICE_TEAM_A_ID` e `MIX_VOICE_TEAM_B_ID` no `.env` e reinicia o bot. Os jogadores devem estar em **voz** para serem movidos.';
    }
    if (result.reason === 'invalid_channels' || result.reason === 'fetch_channels') {
      return '⚠️ **Voz:** um ou ambos os IDs não são canais de **voz** válidos neste servidor.';
    }
    return null;
  }

  const lines = [
    '🎧 **Equipas (voz)**',
    `🔵 **Time A** (\`${result.channelAName}\`): ${result.teamA.map((id) => `<@${id}>`).join(' ')}`,
    `🔴 **Time B** (\`${result.channelBName}\`): ${result.teamB.map((id) => `<@${id}>`).join(' ')}`,
  ];
  if (result.failed?.length) {
    lines.push(
      `⚠️ **Não movidos:** ${result.failed.map((f) => `<@${f.userId}> (${f.reason})`).join(' · ')}`,
    );
  } else {
    lines.push('✅ Todos foram movidos para os canais de voz.');
  }
  return lines.join('\n');
}

import { ChannelType } from 'discord.js';
import { getSession, setSession } from './mixSession.js';

/**
 * Adiciona uma mensagem à lista de limpeza da sessão (com de-dupe).
 * @param {import('./mixSession.js').MixSession} session
 * @param {string} channelId
 * @param {string} messageId
 */
export function addCleanup(session, channelId, messageId) {
  if (!session || !channelId || !messageId) return;
  if (!Array.isArray(session.cleanupMessages)) {
    session.cleanupMessages = [];
  }
  const exists = session.cleanupMessages.some(
    (r) => r.channelId === channelId && r.messageId === messageId,
  );
  if (!exists) {
    session.cleanupMessages.push({ channelId, messageId });
  }
}

/**
 * @param {import('discord.js').Client} client
 * @param {string} channelId
 * @returns {Promise<import('discord.js').TextBasedChannel | null>}
 */
async function fetchTextChannel(client, channelId) {
  try {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch) return null;
    if (
      ch.type === ChannelType.GuildText ||
      ch.type === ChannelType.GuildAnnouncement ||
      ch.type === ChannelType.PublicThread ||
      ch.type === ChannelType.PrivateThread ||
      ch.type === ChannelType.AnnouncementThread
    ) {
      return /** @type {import('discord.js').TextBasedChannel} */ (ch);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Apaga as mensagens registradas em `session.cleanupMessages` após `delayMs`.
 * Usa bulkDelete por canal quando possível (mais barato); fallback delete uma a uma.
 * Limpa a sessão no final.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {number} delayMs
 */
export function scheduleCleanup(client, guildId, delayMs) {
  if (!Number.isFinite(delayMs) || delayMs <= 0) return;
  setTimeout(async () => {
    try {
      const session = getSession(guildId);
      if (!session) return;
      const refs = Array.isArray(session.cleanupMessages)
        ? session.cleanupMessages
        : [];

      /** @type {Map<string, string[]>} channelId -> messageIds */
      const byChannel = new Map();
      for (const r of refs) {
        if (!r?.channelId || !r?.messageId) continue;
        const arr = byChannel.get(r.channelId) ?? [];
        arr.push(r.messageId);
        byChannel.set(r.channelId, arr);
      }

      for (const [channelId, ids] of byChannel) {
        const channel = await fetchTextChannel(client, channelId);
        if (!channel) continue;

        let bulkOk = false;
        if (ids.length >= 2 && typeof channel.bulkDelete === 'function') {
          try {
            await channel.bulkDelete(ids, true);
            bulkOk = true;
          } catch {
            bulkOk = false;
          }
        }

        if (!bulkOk) {
          for (const id of ids) {
            try {
              await channel.messages.delete(id);
            } catch (e) {
              if (e && typeof e === 'object' && 'code' in e && e.code === 10008) continue;
            }
          }
        }
      }
      // Esvazia a lista de mensagens já apagadas, mas mantém a sessão
      // (a sessão só é encerrada por /win ou /mix reset).
      const refreshed = getSession(guildId);
      if (refreshed) {
        refreshed.cleanupMessages = [];
        setSession(guildId, refreshed);
      }
    } catch (e) {
      console.error('[mixCleanup] Falha ao limpar mensagens:', e);
    }
  }, delayMs);
}

/** @returns {number} delay em ms (0 = desativado). Padrão 30000. */
export function readCleanupDelayMs() {
  const raw = String(process.env.MIX_CLEANUP_DELAY_MS ?? '30000').trim();
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 30000;
  return n;
}

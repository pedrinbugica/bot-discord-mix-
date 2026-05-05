import { MIX_QUEUE_MAX } from '../queue/mixQueue.js';

/**
 * @param {string[]} userIds
 */
export function buildFullMixMessage(userIds) {
  const roleId = process.env.MIX_PING_ROLE_ID?.trim();
  const useHere = ['1', 'true', 'yes'].includes(
    String(process.env.MIX_PING_HERE || '').toLowerCase(),
  );

  const lines = [];
  if (roleId) lines.push(`<@&${roleId}>`);
  if (useHere) lines.push('@here');
  lines.push(`🎉 **Mix completo** — **${MIX_QUEUE_MAX}** jogadores!`);
  lines.push(userIds.map((id) => `<@${id}>`).join(' '));
  return lines.join('\n');
}

/**
 * @param {string[]} userIds
 * @returns {import('discord.js').MessageMentionOptions}
 */
export function announceAllowedMentions(userIds) {
  const roleId = process.env.MIX_PING_ROLE_ID?.trim();
  const useHere = ['1', 'true', 'yes'].includes(
    String(process.env.MIX_PING_HERE || '').toLowerCase(),
  );

  /** @type {import('discord.js').MessageMentionOptions} */
  const out = {
    users: [...userIds],
    roles: roleId ? [roleId] : [],
    parse: useHere ? ['everyone'] : [],
  };
  return out;
}

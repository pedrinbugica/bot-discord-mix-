/**
 * Resolve a Guild só a partir do cache do gateway (sem GET /guilds na REST).
 * Evita 404 "Unknown Guild" em cenários em que o bot está no servidor mas o fetch REST falha ou não aplica.
 *
 * @param {import('discord.js').Client} client
 * @param {string} guildId
 * @param {import('discord.js').Guild | null} [hint] — normalmente interaction.guild
 * @returns {import('discord.js').Guild | null}
 */
export function resolveGuild(client, guildId, hint = null) {
  return hint ?? client.guilds.cache.get(guildId) ?? null;
}

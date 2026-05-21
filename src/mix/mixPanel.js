import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import { MIX_QUEUE_MAX } from '../queue/mixQueue.js';
import { resolveVoiceLobbyId } from '../store/guildConfig.js';

export const MIX_JOIN_ID = 'mix_join';
export const MIX_LEAVE_ID = 'mix_leave';

/** Logo CS2 (PNG direto, Wikimedia Commons) — funciona em thumbnails do Discord com https. */
const DEFAULT_EMBED_THUMB =
  'https://upload.wikimedia.org/wikipedia/commons/9/9c/Counter_Strike_2_Logo.png';

/**
 * URL para `setThumbnail`: tem de ser link **direto** ao ficheiro (png/jpg/gif/webp), em **https**.
 * `MIX_EMBED_THUMB_URL` vazio usa o logo CS2 por defeito; `none` / `false` / `0` desativa a imagem.
 * @returns {string | null}
 */
function resolveEmbedThumbnailUrl() {
  const raw = process.env.MIX_EMBED_THUMB_URL?.trim();
  if (!raw) return DEFAULT_EMBED_THUMB;
  const lower = raw.toLowerCase();
  if (lower === 'none' || lower === 'false' || lower === 'off' || lower === '0') {
    return null;
  }
  let url = raw;
  if (/^http:\/\//i.test(url)) {
    url = 'https://' + url.slice('http://'.length);
  }
  if (!/^https:\/\//i.test(url)) {
    return DEFAULT_EMBED_THUMB;
  }
  return url;
}

function embedAccentColor() {
  const raw = process.env.MIX_EMBED_COLOR?.trim().replace(/^#/, '');
  if (!raw) return 0x5865f2;
  const n = parseInt(raw, 16);
  return Number.isFinite(n) && n >= 0 && n <= 0xffffff ? n : 0x5865f2;
}

/**
 * @param {import('discord.js').Guild | null} guild — se null, lista só com menções (sem ir buscar nomes).
 * @param {string[]} userIds
 * @param {string | null} [guildId]
 */
export async function buildPanelContent(guild, userIds, guildId = null) {
  const slotEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
  const lines = [];
  for (let i = 0; i < userIds.length; i++) {
    const id = userIds[i];
    const slot = i < slotEmoji.length ? slotEmoji[i] : `**${i + 1}.**`;
    if (guild) {
      const m = await guild.members.fetch(id).catch(() => null);
      const label = m?.user?.username ?? 'Usuário';
      lines.push(`${slot} **${label}** · <@${id}>`);
    } else {
      lines.push(`${slot} <@${id}>`);
    }
  }
  const list = lines.length ? lines.join('\n') : '_Ninguém na fila — sê o primeiro._';

  const lobbyId = resolveVoiceLobbyId(guildId ?? guild?.id ?? null);
  const lobbyHint = lobbyId
    ? `\n\n🔊 **Lobby:** <#${lobbyId}> — entra neste canal de voz antes de **Entrar na fila**.`
    : '';

  const thumb = resolveEmbedThumbnailUrl();
  const embed = new EmbedBuilder()
    .setTitle('🎮 Fila do mix')
    .setColor(embedAccentColor())
    .setDescription(
      `📋 **${userIds.length}/${MIX_QUEUE_MAX}** jogadores na fila\n\n${list}\n\n✅ Quando a fila encher, todos são avisados e a fila reinicia.${lobbyHint}`,
    )
    .setFooter({ text: 'Mix • Usa os botões abaixo' });

  if (thumb) {
    embed.setThumbnail(thumb);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(MIX_JOIN_ID)
      .setLabel('Entrar')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(MIX_LEAVE_ID)
      .setLabel('Sair')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Danger),
  );

  return { embeds: [embed], components: [row] };
}

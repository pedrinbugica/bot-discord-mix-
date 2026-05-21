import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { getGuildConfig, setGuildConfig } from '../store/guildConfig.js';

export const data = new SlashCommandBuilder()
  .setName('configurar')
  .setDescription('Configura os canais de voz do mix neste servidor (apenas admins).')
  .addSubcommand((sub) =>
    sub
      .setName('canais')
      .setDescription('Define os canais de voz do lobby, Time A e Time B.')
      .addChannelOption((opt) =>
        opt
          .setName('lobby')
          .setDescription('Canal de voz onde os jogadores devem estar para entrar na fila.')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(false),
      )
      .addChannelOption((opt) =>
        opt
          .setName('time-a')
          .setDescription('Canal de voz do Time A.')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(false),
      )
      .addChannelOption((opt) =>
        opt
          .setName('time-b')
          .setDescription('Canal de voz do Time B.')
          .addChannelTypes(ChannelType.GuildVoice)
          .setRequired(false),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('ver')
      .setDescription('Mostra a configuração atual de canais de voz deste servidor.'),
  );

async function isAdmin(interaction) {
  const manage = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  if (manage) return true;
  const roleId = process.env.MIX_ADMIN_ROLE_ID?.trim();
  if (roleId) {
    const m = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (m?.roles.cache.has(roleId)) return true;
  }
  return false;
}

export async function execute(interaction) {
  if (!interaction.guildId || !interaction.guild) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Usa este comando dentro de um servidor.',
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'ver') {
    const cfg = getGuildConfig(interaction.guildId);
    const lobby = cfg.voiceLobbyId ? `<#${cfg.voiceLobbyId}>` : '_não configurado_';
    const teamA = cfg.voiceTeamAId ? `<#${cfg.voiceTeamAId}>` : '_não configurado_';
    const teamB = cfg.voiceTeamBId ? `<#${cfg.voiceTeamBId}>` : '_não configurado_';
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        `**Configuração de canais de voz deste servidor:**\n` +
        `🔊 Lobby: ${lobby}\n` +
        `🔵 Time A: ${teamA}\n` +
        `🔴 Time B: ${teamB}`,
    });
    return;
  }

  if (!(await isAdmin(interaction))) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Precisas da permissão **Gerir servidor** ou do cargo admin para usar este comando.',
    });
    return;
  }

  const lobby = interaction.options.getChannel('lobby');
  const teamA = interaction.options.getChannel('time-a');
  const teamB = interaction.options.getChannel('time-b');

  if (!lobby && !teamA && !teamB) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Indica pelo menos um canal para configurar.',
    });
    return;
  }

  /** @type {import('../store/guildConfig.js').GuildConfig} */
  const update = {};
  if (lobby) update.voiceLobbyId = lobby.id;
  if (teamA) update.voiceTeamAId = teamA.id;
  if (teamB) update.voiceTeamBId = teamB.id;

  setGuildConfig(interaction.guildId, update);

  const lines = ['✅ **Configuração guardada:**'];
  if (lobby) lines.push(`🔊 Lobby: <#${lobby.id}>`);
  if (teamA) lines.push(`🔵 Time A: <#${teamA.id}>`);
  if (teamB) lines.push(`🔴 Time B: <#${teamB.id}>`);

  await interaction.reply({
    flags: MessageFlags.Ephemeral,
    content: lines.join('\n'),
  });
}

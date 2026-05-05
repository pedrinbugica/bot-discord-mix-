import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { buildPanelContent } from '../mix/mixPanel.js';
import { resolveGuild } from '../mix/resolveGuild.js';
import * as queue from '../queue/mixQueue.js';

export const data = new SlashCommandBuilder()
  .setName('mix')
  .setDescription('Fila de mix: criar painel ou reiniciar (staff).')
  .addSubcommand((sub) =>
    sub
      .setName('panel')
      .setDescription('Publica o painel da fila neste canal de texto.'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset')
      .setDescription(
        'Limpa a fila e remove o painel antigo (Gerir servidor ou cargo admin).',
      ),
  );

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({
      content:
        'Usa `/mix` num **canal do servidor**. Não funciona na conversa direta com o bot.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'reset') {
    await handleReset(interaction);
    return;
  }

  const guildId = interaction.guildId;
  const guild = resolveGuild(interaction.client, guildId, interaction.guild);

  if (queue.hasPanel(guildId)) {
    await interaction.reply({
      content:
        'Já existe um painel neste servidor. Usa `/mix reset` (staff) ou os botões no painel antigo.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userIds = queue.getUserIds(guildId);
  const payload = await buildPanelContent(guild, userIds);
  const callback = await interaction.reply({ ...payload, withResponse: true });
  const msg = callback.resource?.message ?? (await interaction.fetchReply());
  queue.setPanel(guildId, interaction.channelId, msg.id);
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleReset(interaction) {
  const guildId = interaction.guildId;
  const guild = interaction.guild;
  if (!guildId || !guild) {
    await interaction.reply({
      content: 'Comando só funciona dentro de um servidor.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const manage =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;
  const roleId = process.env.MIX_ADMIN_ROLE_ID?.trim();
  let roleOk = false;
  if (roleId) {
    const m = await guild.members.fetch(interaction.user.id).catch(() => null);
    roleOk = m?.roles.cache.has(roleId) ?? false;
  }

  if (!manage && !roleOk) {
    await interaction.reply({
      content:
        'Precisas da permissão **Gerir servidor** ou do cargo definido em `MIX_ADMIN_ROLE_ID` no `.env`.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const panel = queue.getPanel(guildId);
  if (panel) {
    const ch = await guild.channels.fetch(panel.channelId).catch(() => null);
    if (ch?.isTextBased()) {
      await ch.messages.delete(panel.messageId).catch(() => {});
    }
  }

  queue.clearUsers(guildId);
  queue.clearPanel(guildId);

  await interaction.reply({
    content:
      '**Mix reiniciado.** Fila limpa e painel antigo removido (se existia). Usa `/mix panel` para criar um painel novo.',
    flags: MessageFlags.Ephemeral,
  });
}

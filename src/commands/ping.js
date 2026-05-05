import { SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Responde com Pong e a latência do bot.');

export async function execute(interaction) {
  const res = await interaction.reply({ content: 'Calculando…', withResponse: true });
  const sent = res.resource?.message ?? (await interaction.fetchReply());
  const latency = sent.createdTimestamp - interaction.createdTimestamp;
  await interaction.editReply(`Ping! Latência: **${latency}** ms.`);
}

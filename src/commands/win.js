import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { clearSession, getSession } from '../mix/mixSession.js';
import { recordResult } from '../history/historyStore.js';

export const data = new SlashCommandBuilder()
  .setName('win')
  .setDescription('Capitão registra o resultado da série BO3.')
  .addStringOption((opt) =>
    opt
      .setName('time')
      .setDescription('Time vencedor (a ou b)')
      .setRequired(true)
      .addChoices({ name: 'A', value: 'a' }, { name: 'B', value: 'b' }),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('mapas_a')
      .setDescription('Mapas ganhos pelo Time A (0..2)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(2),
  )
  .addIntegerOption((opt) =>
    opt
      .setName('mapas_b')
      .setDescription('Mapas ganhos pelo Time B (0..2)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(2),
  );

const VALID_BO3 = new Set(['2-0', '2-1', '1-2', '0-2']);

export async function execute(interaction) {
  if (!interaction.guildId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Usa este comando dentro de um servidor.',
    });
    return;
  }

  const session = getSession(interaction.guildId);
  if (!session || session.phase !== 'awaiting_result' || !session.matchId) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Não há mix aguardando resultado. Espera o veto BO3 acabar.',
    });
    return;
  }

  const userId = interaction.user.id;
  if (userId !== session.captains.A && userId !== session.captains.B) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Só os capitães da partida atual podem usar /win.',
    });
    return;
  }

  const team = String(interaction.options.getString('time', true)).toUpperCase();
  let mapsA = interaction.options.getInteger('mapas_a', true);
  let mapsB = interaction.options.getInteger('mapas_b', true);

  if (!VALID_BO3.has(`${mapsA}-${mapsB}`)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Placar inválido para BO3. Usa 2-0, 2-1, 1-2 ou 0-2.',
    });
    return;
  }

  // UX: muita gente digita "2-0" como placar do vencedor, independente do time escolhido.
  // Se o utilizador escolheu Time B mas escreveu 2-0 (em mapas_a), inverte automaticamente (0-2).
  // Idem para Time A.
  if (team === 'A' && mapsA < mapsB) {
    [mapsA, mapsB] = [mapsB, mapsA];
  } else if (team === 'B' && mapsB < mapsA) {
    [mapsA, mapsB] = [mapsB, mapsA];
  }

  if (!VALID_BO3.has(`${mapsA}-${mapsB}`)) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        'Placar inválido para BO3. Se tu escolhe o Time vencedor, usa 2-0 ou 2-1; ou informa explicitamente (ex.: A 0 x 2 B).',
    });
    return;
  }

  const winnerByScore = mapsA > mapsB ? 'A' : 'B';
  if (winnerByScore !== team) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content:
        `O placar indica vitória do Time **${winnerByScore}**.` +
        ` Se o vencedor foi o Time **${team}**, tenta inverter o placar (ex.: 0-2).`,
    });
    return;
  }

  const updated = recordResult(interaction.guildId, session.matchId, {
    winner: /** @type {'A' | 'B'} */ (team),
    mapsA,
    mapsB,
  });

  if (!updated) {
    await interaction.reply({
      flags: MessageFlags.Ephemeral,
      content: 'Não foi possível encontrar a partida no histórico.',
    });
    return;
  }

  session.phase = 'done';
  clearSession(interaction.guildId);

  const captainA = session.captains.A;
  const captainB = session.captains.B;
  const decider = updated.decider ?? '-';

  await interaction.reply({
    content:
      `🏆 **Resultado registrado**\n` +
      `🔵 **Time A** ${mapsA} x ${mapsB} **Time B** 🔴\n` +
      `🥇 Vencedor: **Time ${team}**\n` +
      `🧢 Capitães: <@${captainA}> vs <@${captainB}>\n` +
      `🟣 Decider: **${decider}**`,
    allowedMentions: { users: [captainA, captainB].filter(Boolean) },
  });

  // Apaga a mensagem após 10s para não poluir o chat
  const msg = await interaction.fetchReply().catch(() => null);
  if (msg) {
    setTimeout(() => {
      msg.delete().catch(() => {});
    }, 10_000);
  }
}

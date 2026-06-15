import 'dotenv/config';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { data as mixData, execute as mixExecute } from './commands/mix.js';
import { data as pingData, execute as pingExecute } from './commands/ping.js';
import { data as winData, execute as winExecute } from './commands/win.js';
import {
  data as historicoData,
  execute as historicoExecute,
  HISTORY_NEXT,
  HISTORY_PREV,
  handleHistoryButton,
} from './commands/historico.js';
import { data as configurarData, execute as configurarExecute } from './commands/configurar.js';
import { data as perguntaData, execute as perguntaExecute } from './commands/pergunta.js';
import { handleMixButton } from './mix/mixButtons.js';
import { MIX_JOIN_ID, MIX_LEAVE_ID } from './mix/mixPanel.js';
import { VOTE_PREFIX, handleCaptainVoteButton } from './mix/mixCaptainVote.js';
import { VETO_PREFIX, handleVetoButton } from './mix/mixVeto.js';
import { logError } from './util/logger.js';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Defina DISCORD_TOKEN no .env (token da aba Bot no Developer Portal).');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

/** @type {Collection<string, { data: import('discord.js').SlashCommandBuilder; execute: Function }>} */
client.commands = new Collection();
client.commands.set(pingData.name, { data: pingData, execute: pingExecute });
client.commands.set(mixData.name, { data: mixData, execute: mixExecute });
client.commands.set(winData.name, { data: winData, execute: winExecute });
client.commands.set(historicoData.name, {
  data: historicoData,
  execute: historicoExecute,
});
client.commands.set(configurarData.name, { data: configurarData, execute: configurarExecute });
client.commands.set(perguntaData.name, { data: perguntaData, execute: perguntaExecute });

process.on('unhandledRejection', (reason) => {
  logError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
});

client.once(Events.ClientReady, (c) => {
  console.log(`[${new Date().toISOString()}] Conectado como ${c.user.tag} · ${c.guilds.cache.size} servidor(es)`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      const cid = String(interaction.customId);
      if (cid === MIX_JOIN_ID || cid === MIX_LEAVE_ID) {
        await handleMixButton(interaction);
      } else if (cid.startsWith(`${VOTE_PREFIX}_`)) {
        await handleCaptainVoteButton(interaction);
      } else if (cid.startsWith(`${VETO_PREFIX}_`)) {
        await handleVetoButton(interaction);
      } else if (
        cid.startsWith(`${HISTORY_PREV}:`) ||
        cid.startsWith(`${HISTORY_NEXT}:`)
      ) {
        await handleHistoryButton(interaction);
      }
    }
  } catch (err) {
    logError('InteractionCreate', err, {
      command: interaction.isChatInputCommand() ? interaction.commandName : undefined,
      customId: interaction.isButton() ? interaction.customId : undefined,
      guildId: interaction.guildId ?? undefined,
    });
    const msg = {
      content: '❌ Algo correu mal. Se persistir, avisa um administrador e vê o terminal do bot.',
      flags: MessageFlags.Ephemeral,
    };
    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      } else if (interaction.isButton()) {
        if (interaction.deferred || interaction.replied) await interaction.followUp(msg);
        else await interaction.reply(msg);
      }
    } catch (e) {
      logError('InteractionCreate.followUp', e);
    }
  }
});

client.login(token);

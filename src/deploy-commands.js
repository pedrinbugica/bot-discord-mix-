// Regista slash commands. Requer DISCORD_TOKEN e DISCORD_CLIENT_ID no .env.
// Bot no servidor: Send Messages, Embed Links, Read History, Mention Everyone (se MIX_PING_HERE/cargo).
// Mix voz: Connect + Move Members nos canais Time A/B; convite OAuth com scopes bot + applications.commands.
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { data as mixData } from './commands/mix.js';
import { data as pingData } from './commands/ping.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

const commands = [pingData.toJSON(), mixData.toJSON()];

if (!token || !clientId) {
  console.error('Defina DISCORD_TOKEN e DISCORD_CLIENT_ID no arquivo .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

try {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Comandos registrados no servidor ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Comandos registrados globalmente (podem levar até ~1 h para aparecer).');
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const CONFIG_FILE = path.join(DATA_DIR, 'guild-config.json');

/**
 * @typedef {{ voiceLobbyId?: string; voiceTeamAId?: string; voiceTeamBId?: string }} GuildConfig
 */

function load() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { version: 1, guilds: {} };
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data?.guilds || typeof data.guilds !== 'object') return { version: 1, guilds: {} };
    return data;
  } catch {
    return { version: 1, guilds: {} };
  }
}

function persist(state) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(state), 'utf8');
  } catch (e) {
    console.error('[guildConfig] Falha ao gravar:', e);
  }
}

/** @param {string} guildId @returns {GuildConfig} */
export function getGuildConfig(guildId) {
  return load().guilds[guildId] ?? {};
}

/** @param {string} guildId @param {GuildConfig} config */
export function setGuildConfig(guildId, config) {
  const state = load();
  state.guilds[guildId] = { ...(state.guilds[guildId] ?? {}), ...config };
  persist(state);
}

/** @param {string | null} guildId @returns {string | null} */
export function resolveVoiceLobbyId(guildId) {
  if (guildId) {
    const cfg = getGuildConfig(guildId);
    if (cfg.voiceLobbyId) return cfg.voiceLobbyId;
  }
  return process.env.MIX_VOICE_LOBBY_ID?.trim() || null;
}

/** @param {string | null} guildId @returns {{ teamAId: string | null; teamBId: string | null }} */
export function resolveVoiceTeamIds(guildId) {
  if (guildId) {
    const cfg = getGuildConfig(guildId);
    if (cfg.voiceTeamAId || cfg.voiceTeamBId) {
      return {
        teamAId: cfg.voiceTeamAId || process.env.MIX_VOICE_TEAM_A_ID?.trim() || null,
        teamBId: cfg.voiceTeamBId || process.env.MIX_VOICE_TEAM_B_ID?.trim() || null,
      };
    }
  }
  return {
    teamAId: process.env.MIX_VOICE_TEAM_A_ID?.trim() || null,
    teamBId: process.env.MIX_VOICE_TEAM_B_ID?.trim() || null,
  };
}

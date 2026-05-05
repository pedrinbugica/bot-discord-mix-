import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const MATCH_FILE = path.join(DATA_DIR, 'mix-match.json');

/**
 * @typedef {'captain_vote' | 'map_veto' | 'done'} MatchPhase
 *
 * @typedef {{ teamA: string[]; teamB: string[] }} Teams
 *
 * @typedef {{
 *   startedAt: number;
 *   channelId: string;
 *   phase: MatchPhase;
 *   teams: Teams;
 *   vote?: {
 *     messageAId: string | null;
 *     messageBId: string | null;
 *     votesA: Record<string, string>; // voterId -> candidateId
 *     votesB: Record<string, string>;
 *     deadlineAt: number;
 *     captainA: string | null;
 *     captainB: string | null;
 *   };
 *   veto?: {
 *     messageId: string | null;
 *     pool: string[];
 *     remaining: string[];
 *     actions: { kind: 'ban' | 'pick'; team: 'A' | 'B'; map: string; by: string; at: number }[];
 *     step: number; // 0..6
 *   };
 * }} Match
 *
 * @typedef {{ version: 1; guilds: Record<string, Match> }} MatchStateFile
 */

/** @type {Map<string, Match>} */
const byGuild = new Map();

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist() {
  try {
    /** @type {Record<string, Match>} */
    const guilds = {};
    for (const [gid, m] of byGuild) guilds[gid] = m;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    /** @type {MatchStateFile} */
    const payload = { version: 1, guilds };
    fs.writeFileSync(MATCH_FILE, JSON.stringify(payload), 'utf8');
  } catch (e) {
    console.error('[matchStore] Falha ao gravar estado:', e);
  }
}

function load() {
  try {
    if (!fs.existsSync(MATCH_FILE)) return;
    const raw = fs.readFileSync(MATCH_FILE, 'utf8');
    const data = safeJsonParse(raw);
    if (!data?.guilds || typeof data.guilds !== 'object') return;
    for (const [gid, m] of Object.entries(data.guilds)) {
      if (typeof gid !== 'string' || !m || typeof m !== 'object') continue;
      // Guardrail mínimo: só carrega se tiver channelId + teams.
      if (typeof m.channelId !== 'string') continue;
      if (!m.teams || !Array.isArray(m.teams.teamA) || !Array.isArray(m.teams.teamB)) continue;
      byGuild.set(gid, /** @type {Match} */ (m));
    }
  } catch (e) {
    console.error('[matchStore] Falha ao carregar estado:', e);
  }
}

export function getMatch(guildId) {
  return byGuild.get(guildId) ?? null;
}

export function setMatch(guildId, match) {
  byGuild.set(guildId, match);
  persist();
}

export function clearMatch(guildId) {
  if (!byGuild.has(guildId)) return;
  byGuild.delete(guildId);
  persist();
}

load();


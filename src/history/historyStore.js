import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const HISTORY_FILE = path.join(DATA_DIR, 'mix-history.json');

/**
 * @typedef {{ winner: 'A' | 'B'; mapsA: number; mapsB: number }} MatchResult
 *
 * @typedef {{
 *   id: string;
 *   startedAt: number;
 *   finishedAt: number | null;
 *   channelId: string;
 *   teamA: string[];
 *   teamB: string[];
 *   captainA: string;
 *   captainB: string;
 *   bans: string[];
 *   picks: { A?: string; B?: string };
 *   decider?: string;
 *   result: MatchResult | null;
 * }} Match
 *
 * @typedef {{ version: 1; guilds: Record<string, { matches: Match[] }> }} HistoryFile
 */

/** @returns {HistoryFile} */
function emptyState() {
  return { version: 1, guilds: {} };
}

/** @returns {HistoryFile} */
function load() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return emptyState();
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.guilds) return emptyState();
    return /** @type {HistoryFile} */ (data);
  } catch (e) {
    console.error('[historyStore] Falha ao carregar:', e);
    return emptyState();
  }
}

/** @param {HistoryFile} state */
function persist(state) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(state), 'utf8');
  } catch (e) {
    console.error('[historyStore] Falha ao gravar:', e);
  }
}

function ensureGuild(state, guildId) {
  if (!state.guilds[guildId]) state.guilds[guildId] = { matches: [] };
  return state.guilds[guildId];
}

/**
 * Cria entrada pendente (sem resultado) e devolve a partida criada.
 * @param {string} guildId
 * @param {Omit<Match, 'id' | 'finishedAt' | 'result'> & { id?: string }} match
 * @returns {Match}
 */
export function recordPending(guildId, match) {
  const state = load();
  const g = ensureGuild(state, guildId);
  /** @type {Match} */
  const entry = {
    id: match.id || `${match.startedAt}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: match.startedAt,
    finishedAt: null,
    channelId: match.channelId,
    teamA: match.teamA,
    teamB: match.teamB,
    captainA: match.captainA,
    captainB: match.captainB,
    bans: match.bans,
    picks: match.picks,
    decider: match.decider,
    result: null,
  };
  g.matches.push(entry);
  persist(state);
  return entry;
}

/**
 * @param {string} guildId
 * @param {string} matchId
 * @param {MatchResult} result
 * @returns {Match | null}
 */
export function recordResult(guildId, matchId, result) {
  const state = load();
  const g = ensureGuild(state, guildId);
  const idx = g.matches.findIndex((m) => m.id === matchId);
  if (idx === -1) return null;
  g.matches[idx] = {
    ...g.matches[idx],
    finishedAt: Date.now(),
    result,
  };
  persist(state);
  return g.matches[idx];
}

/**
 * @param {string} guildId
 * @param {string} userId
 * @returns {Match | null}
 */
export function findPendingByCaptain(guildId, userId) {
  const state = load();
  const g = state.guilds[guildId];
  if (!g) return null;
  for (let i = g.matches.length - 1; i >= 0; i--) {
    const m = g.matches[i];
    if (m.result === null && (m.captainA === userId || m.captainB === userId)) {
      return m;
    }
  }
  return null;
}

/**
 * Lista partidas mais recentes (filtra por jogador se informado).
 * @param {string} guildId
 * @param {{ userId?: string; limit?: number; offset?: number }} [opts]
 * @returns {{ matches: Match[]; total: number }}
 */
export function listMatches(guildId, opts = {}) {
  const { userId, limit = 10, offset = 0 } = opts;
  const state = load();
  const g = state.guilds[guildId];
  if (!g) return { matches: [], total: 0 };

  const filtered = userId
    ? g.matches.filter(
        (m) => m.teamA.includes(userId) || m.teamB.includes(userId),
      )
    : g.matches;

  const sorted = [...filtered].sort(
    (a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt),
  );

  return {
    matches: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

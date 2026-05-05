import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const STATE_FILE = path.join(DATA_DIR, 'mix-state.json');

/** @returns {number} — mínimo 2; padrão 10; define `MIX_QUEUE_MAX` no `.env` (ex.: 2 para testes). */
function readMixQueueMax() {
  const raw = process.env.MIX_QUEUE_MAX;
  const n =
    raw !== undefined && raw !== '' ? parseInt(String(raw).trim(), 10) : 10;
  if (!Number.isFinite(n) || n < 2) return 10;
  return Math.min(n, 99);
}

/** Número de jogadores para fechar o mix. */
export const MIX_QUEUE_MAX = readMixQueueMax();

/** @typedef {{ userIds: string[]; panelMessageId: string | null; channelId: string | null }} GuildQueue */

/** @type {Map<string, GuildQueue>} */
const byGuild = new Map();

function persistQueueState() {
  try {
    /** @type {Record<string, GuildQueue>} */
    const guilds = {};
    for (const [guildId, q] of byGuild) {
      guilds[guildId] = {
        userIds: [...q.userIds],
        channelId: q.channelId,
        panelMessageId: q.panelMessageId,
      };
    }
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ version: 1, guilds }),
      'utf8',
    );
  } catch (e) {
    console.error('[mixQueue] Falha ao gravar estado:', e);
  }
}

function loadPersistedMixState() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const data = JSON.parse(raw);
    if (!data?.guilds || typeof data.guilds !== 'object') return;
    const max = MIX_QUEUE_MAX;
    for (const [guildId, q] of Object.entries(data.guilds)) {
      if (typeof guildId !== 'string' || !q || typeof q !== 'object') continue;
      const userIds = Array.isArray(q.userIds)
        ? q.userIds.filter((id) => typeof id === 'string').slice(0, max)
        : [];
      const channelId = typeof q.channelId === 'string' ? q.channelId : null;
      const panelMessageId =
        typeof q.panelMessageId === 'string' ? q.panelMessageId : null;
      byGuild.set(guildId, { userIds, channelId, panelMessageId });
    }
  } catch (e) {
    console.error('[mixQueue] Falha ao carregar estado:', e);
  }
}

function ensure(guildId) {
  let q = byGuild.get(guildId);
  if (!q) {
    q = { userIds: [], panelMessageId: null, channelId: null };
    byGuild.set(guildId, q);
  }
  return q;
}

export function setPanel(guildId, channelId, messageId) {
  const q = ensure(guildId);
  q.channelId = channelId;
  q.panelMessageId = messageId;
  persistQueueState();
}

export function clearPanel(guildId) {
  const q = byGuild.get(guildId);
  if (!q) return;
  q.panelMessageId = null;
  q.channelId = null;
  persistQueueState();
}

export function hasPanel(guildId) {
  const q = byGuild.get(guildId);
  return !!(q?.panelMessageId && q?.channelId);
}

export function getPanel(guildId) {
  const q = byGuild.get(guildId);
  if (!q?.panelMessageId || !q?.channelId) return null;
  return { messageId: q.panelMessageId, channelId: q.channelId };
}

/**
 * @returns {{ status: 'joined'; count: number; full: boolean } | { status: 'already' } | { status: 'full' }}
 */
export function joinQueue(guildId, userId) {
  const q = ensure(guildId);
  if (q.userIds.includes(userId)) return { status: 'already' };
  if (q.userIds.length >= MIX_QUEUE_MAX) return { status: 'full' };
  q.userIds.push(userId);
  const full = q.userIds.length >= MIX_QUEUE_MAX;
  persistQueueState();
  return { status: 'joined', count: q.userIds.length, full };
}

/**
 * @returns {{ status: 'left'; count: number } | { status: 'not_in' }}
 */
export function leaveQueue(guildId, userId) {
  const q = ensure(guildId);
  const i = q.userIds.indexOf(userId);
  if (i === -1) return { status: 'not_in' };
  q.userIds.splice(i, 1);
  persistQueueState();
  return { status: 'left', count: q.userIds.length };
}

export function clearUsers(guildId) {
  ensure(guildId).userIds = [];
  persistQueueState();
}

/** Cópia da ordem atual na fila. */
export function getUserIds(guildId) {
  return [...ensure(guildId).userIds];
}

loadPersistedMixState();

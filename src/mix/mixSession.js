/**
 * Sessões em memória (volátil entre restarts).
 * @typedef {'voting' | 'veto' | 'done'} MixPhase
 *
 * @typedef {{
 *   phase: MixPhase;
 *   teamA: string[];
 *   teamB: string[];
 *   votes: { A: Map<string, string>; B: Map<string, string> }; // voterId -> candidateId
 *   captains: { A?: string; B?: string };
 *   voteMessageAId?: string;
 *   voteMessageBId?: string;
 *   veto?: {
 *     step: number; // 0..6
 *     mapsLeft: string[];
 *     picks: { A?: string; B?: string };
 *     bans: string[];
 *     decider?: string;
 *     lastActionAt?: number;
 *   };
 *   panelChannelId: string;
 *   voteDeadlineAt?: number;
 *   vetoDeadlineAt?: number;
 * }} MixSession
 */

/** @type {Map<string, MixSession>} */
const sessions = new Map();

export function getSession(guildId) {
  return sessions.get(guildId) ?? null;
}

export function setSession(guildId, session) {
  sessions.set(guildId, session);
}

export function clearSession(guildId) {
  sessions.delete(guildId);
}


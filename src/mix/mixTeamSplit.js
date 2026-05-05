/** @param {string[]} arr */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Divide os jogadores em 2 times, usando o mesmo modo do `.env`.
 * @param {string[]} userIds
 * @returns {{ teamA: string[]; teamB: string[]; ordered: string[] }}
 */
export function splitMixTeams(userIds) {
  let ordered = [...userIds];
  const mode = String(process.env.MIX_SPLIT_MODE || 'shuffle').toLowerCase();
  if (mode === 'shuffle') {
    ordered = shuffle(ordered);
  }
  const mid = Math.ceil(ordered.length / 2);
  const teamA = ordered.slice(0, mid);
  const teamB = ordered.slice(mid);
  return { teamA, teamB, ordered };
}


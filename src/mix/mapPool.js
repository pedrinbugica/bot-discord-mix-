/**
 * Lê o pool de mapas do env (fallback = Active Duty do plano).
 * @returns {string[]}
 */
export function readMapPool() {
  const raw = String(process.env.MIX_MAP_POOL || '').trim();
  const pool = raw
    ? raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['Anubis', 'Ancient', 'Dust 2', 'Inferno', 'Mirage', 'Nuke', 'Train'];
  return [...new Set(pool)];
}


const BASE = 'https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/2026-2027';

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); if (row.some(v => v !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

async function csv(path) {
  const r = await fetch(`${BASE}/${path}`, { cf: { cacheTtl: 900, cacheEverything: true } });
  if (!r.ok) throw new Error(`Source ${path} returned ${r.status}`);
  return parseCSV(await r.text());
}

function positionName(p) {
  return ({ GKP: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' })[p] || p;
}

function rating(p) {
  const form = Math.min(10, Math.max(0, num(p.form))) / 10 * 100;
  const ep = Math.min(12, Math.max(0, num(p.ep_next))) / 12 * 100;
  const ppg = Math.min(12, Math.max(0, num(p.points_per_game))) / 12 * 100;
  const xgi90 = Math.min(1.5, Math.max(0, num(p.expected_goal_involvements_per_90))) / 1.5 * 100;
  const minutes = Math.min(90, Math.max(0, num(p.minutes) / Math.max(1, num(p.starts)) || 0)) / 90 * 100;
  const start = num(p.chance_of_playing_next_round, 100);
  return Math.round(0.28 * ep + 0.22 * form + 0.18 * ppg + 0.16 * xgi90 + 0.10 * minutes + 0.06 * start);
}

export async function getPlayers() {
  const [players, stats, teams] = await Promise.all([
    csv('players.csv'), csv('playerstats.csv'), csv('teams.csv')
  ]);
  const teamMap = Object.fromEntries(teams.map(t => [t.code, t.short_name || t.name]));
  const playerMap = Object.fromEntries(players.map(p => [p.player_id || p.id, p]));
  return stats.map(s => {
    const p = playerMap[s.id] || {};
    return {
      id: s.id,
      name: s.web_name || `${s.first_name || ''} ${s.second_name || ''}`.trim(),
      position: positionName(p.position),
      team: teamMap[p.team_code] || p.team_code || '',
      price: num(s.now_cost) / 10,
      minutes: num(s.minutes),
      starts: num(s.starts),
      form: num(s.form),
      points: num(s.total_points),
      pointsPerGame: num(s.points_per_game),
      expectedPointsNext: num(s.ep_next),
      expectedGoals: num(s.expected_goals),
      expectedAssists: num(s.expected_assists),
      expectedGoalInvolvements: num(s.expected_goal_involvements),
      expectedGoalInvolvements90: num(s.expected_goal_involvements_per_90),
      chanceNext: num(s.chance_of_playing_next_round, 100),
      news: s.news || '',
      rating: rating(s)
    };
  }).filter(p => p.name && p.position);
}

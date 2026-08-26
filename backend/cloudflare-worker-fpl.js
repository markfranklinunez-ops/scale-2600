const DATA_BASE = 'https://raw.githubusercontent.com/olbauday/FPL-Core-Insights/main/data/2026-2027';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS }
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(x => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); if (row.some(x => x !== '')) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0].map(x => x.trim());
  return rows.slice(1).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

const n = (v, d = 0) => { const x = Number(v); return Number.isFinite(x) ? x : d; };
const clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, Number.isFinite(x) ? x : a));

async function load(name) {
  const r = await fetch(`${DATA_BASE}/${name}`, { cf: { cacheTtl: 900, cacheEverything: true } });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return parseCSV(await r.text());
}

function score(p) {
  const ep = clamp(n(p.ep_next) / 10 * 100);
  const form = clamp(n(p.form) / 10 * 100);
  const ppg = clamp(n(p.points_per_game) / 10 * 100);
  const xgi90 = clamp(n(p.expected_goal_involvements_per_90) / 1.2 * 100);
  const availability = clamp(n(p.chance_of_playing_next_round, 100));
  const minutes = clamp(n(p.minutes) / Math.max(1, n(p.starts) * 90) * 100);
  return Math.round(0.32 * ep + 0.20 * form + 0.16 * ppg + 0.16 * xgi90 + 0.10 * minutes + 0.06 * availability);
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'FPL Draft Assistant', source: 'FPL-Core-Insights', season: '2026-2027' });
    }

    if (url.pathname === '/players') {
      try {
        const [players, stats, teams] = await Promise.all([
          load('players.csv'), load('playerstats.csv'), load('teams.csv')
        ]);
        const teamMap = Object.fromEntries(teams.map(t => [t.code, t.short_name]));
        const playerMap = Object.fromEntries(players.map(p => [p.player_id, p]));
        const positionMap = { Goalkeeper: 'GK', Defender: 'DEF', Midfielder: 'MID', Forward: 'FWD' };

        const result = stats.map(s => {
          const p = playerMap[s.id] || {};
          return {
            id: n(s.id),
            name: s.web_name || `${p.first_name || ''} ${p.second_name || ''}`.trim(),
            team: teamMap[p.team_code] || '',
            position: positionMap[p.position] || p.position || '',
            price: n(s.now_cost) / 10,
            points: n(s.total_points),
            ppg: n(s.points_per_game),
            form: n(s.form),
            epNext: n(s.ep_next),
            epThis: n(s.ep_this),
            xG: n(s.expected_goals),
            xA: n(s.expected_assists),
            xGI: n(s.expected_goal_involvements),
            xGI90: n(s.expected_goal_involvements_per_90),
            minutes: n(s.minutes),
            starts: n(s.starts),
            chanceNext: n(s.chance_of_playing_next_round, 100),
            news: s.news || '',
            penaltiesOrder: n(s.penalties_order),
            cornersOrder: n(s.corners_and_indirect_freekicks_order),
            defensiveContribution: n(s.defensive_contribution),
            rating: score(s)
          };
        }).filter(p => p.name && p.position);

        const position = url.searchParams.get('position');
        const limit = Math.min(100, Math.max(1, n(url.searchParams.get('limit'), 30)));
        const filtered = position ? result.filter(p => p.position === position) : result;
        filtered.sort((a, b) => b.rating - a.rating || b.epNext - a.epNext || b.form - a.form);

        return json({
          source: 'FPL-Core-Insights',
          updated: new Date().toISOString(),
          count: filtered.length,
          players: filtered.slice(0, limit)
        });
      } catch (e) {
        return json({ error: String(e?.message || e) }, 502);
      }
    }

    return json({
      service: 'FPL Draft Assistant',
      endpoints: { health: '/health', players: '/players?position=MID&limit=30' }
    });
  }
};

// API-Football provider (API-Sports).
// Keep API_FOOTBALL_KEY server-side. Never put it in the PWA.
// Free plan currently advertises 100 requests/day and access to the documented endpoints.
const BASE = 'https://v3.football.api-sports.io';

async function api(path, key) {
  const r = await fetch(`${BASE}${path}`, { headers: { 'x-apisports-key': key } });
  const body = await r.json();
  if (!r.ok || (body.errors && Object.keys(body.errors).length)) {
    throw new Error(`API-Football error: ${JSON.stringify(body.errors || r.status)}`);
  }
  return body;
}

export async function getPremierLeagueSnapshot(key, season) {
  if (!key) throw new Error('API_FOOTBALL_KEY is not configured');
  const league = 39;
  const [teams, standings] = await Promise.all([
    api(`/teams?league=${league}&season=${season}`, key),
    api(`/standings?league=${league}&season=${season}`, key),
  ]);
  return { league, season, teams, standings };
}

export async function getPlayerStatistics(key, season, page = 1) {
  if (!key) throw new Error('API_FOOTBALL_KEY is not configured');
  return api(`/players?league=39&season=${season}&page=${page}`, key);
}

// football-data.org adapter.
// Requires a server-side FOOTBALL_DATA_TOKEN. Never expose this token in the PWA.
export async function getPremierLeague(token) {
  if (!token) throw new Error('FOOTBALL_DATA_TOKEN is not configured');
  const headers = { 'X-Auth-Token': token };
  const base = 'https://api.football-data.org/v4';
  const [competition, teams, matches] = await Promise.all([
    fetch(`${base}/competitions/PL`, { headers }).then(r => r.json()),
    fetch(`${base}/competitions/PL/teams`, { headers }).then(r => r.json()),
    fetch(`${base}/competitions/PL/matches?status=SCHEDULED`, { headers }).then(r => r.json())
  ]);
  return { competition, teams, matches };
}

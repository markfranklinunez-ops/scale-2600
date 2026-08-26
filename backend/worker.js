const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

// First-pass ranking model. We will replace these weights after validating
// against historical FPL results. The API deliberately accepts normalized
// player data so data-source adapters can be swapped without changing the app.
function playerRating(p) {
  const minutes = clamp((p.minutes || 0) / 90 * 100);
  const form = clamp((p.form || 0) / 10 * 100);
  const fixture = clamp((p.fixture || 3) / 5 * 100);
  const xgi = clamp((p.xgi || 0) * 25);
  const starts = clamp((p.startProbability ?? 0.8) * 100);
  const recent = clamp((p.recentPoints || 0) / 15 * 100);
  return Math.round(
    0.22 * minutes +
    0.20 * form +
    0.18 * fixture +
    0.18 * xgi +
    0.14 * starts +
    0.08 * recent
  );
}

function expectedPoints(p) {
  const base = Number(p.baseExpectedPoints || 0);
  const fixture = 0.75 + clamp(p.fixture || 3, 1, 5) * 0.12;
  const form = 0.75 + clamp(p.form || 0, 0, 10) * 0.05;
  const starts = clamp(p.startProbability ?? 0.8, 0, 1);
  return Math.round(base * fixture * form * starts * 10) / 10;
}

function rankPlayers(players) {
  return players
    .map((p) => ({
      ...p,
      rating: playerRating(p),
      expectedPoints: expectedPoints(p),
    }))
    .sort((a, b) => b.rating - a.rating || b.expectedPoints - a.expectedPoints);
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "fpl-draft-assistant", version: "0.1.0" });
    }

    if (url.pathname === "/rank" && request.method === "POST") {
      try {
        const body = await request.json();
        const players = Array.isArray(body.players) ? body.players.slice(0, 500) : [];
        const ranked = rankPlayers(players);
        return json({ generatedAt: new Date().toISOString(), players: ranked });
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
    }

    return json({
      service: "FPL Draft Assistant backend",
      endpoints: {
        health: "GET /health",
        rank: "POST /rank with {players:[...]}"
      }
    });
  },
};

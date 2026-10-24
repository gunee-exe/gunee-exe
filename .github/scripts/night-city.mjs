// Night City: the last year of GitHub contributions as a skyline at night.
// Every week is a building, every day a window that lights up when there were contributions that day;
// busier weeks build taller towers. Reads the public contributions calendar, so no token is needed.
//   node .github/scripts/night-city.mjs [user] [outFile]      (LOCAL_HTML=page.html to work offline)
import fs from "node:fs";
import path from "node:path";

const USER = process.argv[2] || "gunee-exe";
const OUT = process.argv[3] || "dist/night-city.svg";

const html = process.env.LOCAL_HTML
  ? fs.readFileSync(process.env.LOCAL_HTML, "utf8")
  : await (await fetch(`https://github.com/users/${USER}/contributions`, { headers: { "User-Agent": "night-city" } })).text();

// ---------- parse the calendar: one cell per day, a tooltip with its count ----------
const counts = {};
for (const m of html.matchAll(/<tool-tip[^>]*for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
  const n = m[2].match(/^(\d[\d,]*) contribution/);
  counts[m[1]] = n ? +n[1].replace(/,/g, "") : 0;
}
const days = [];
for (const m of html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})" id="(contribution-day-component-(\d+)-(\d+))" data-level="(\d)"/g)) {
  days.push({ date: m[1], day: +m[3], week: +m[4], level: +m[5], count: counts[m[2]] ?? 0 });
}
if (days.length < 300) throw new Error(`only ${days.length} days parsed: the contributions page layout may have changed`);
days.sort((a, b) => a.date.localeCompare(b.date));
const WEEKS = Math.max(...days.map((d) => d.week)) + 1;
const total = days.reduce((s, d) => s + d.count, 0);
const weekTotals = Array.from({ length: WEEKS }, (_, w) => days.filter((d) => d.week === w).reduce((s, d) => s + d.count, 0));
const maxWeek = Math.max(1, ...weekTotals);

// ---------- layout ----------
const W = 900, H = 320, GROUND = 262, LEFT = 30, RIGHT = 870;
const step = (RIGHT - LEFT) / WEEKS, BW = Math.max(8, Math.floor(step) - 3);
const WIN = 6, WGAP = 2, FLOOR = WIN + WGAP, DAY_FLOORS = 7, MAX_EXTRA = 12;
const rng = ((s) => () => { s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; })(1729);
const LIT = ["#171c23", "#e0a83c", "#f2be4c", "#ffd56b", "#fff1c1"];   // level 0 (dark) to 4 (brightest)
const towers = weekTotals.map((t, w) => ({ w, t })).sort((a, b) => b.t - a.t).slice(0, 3).filter((x) => x.t > 0).map((x) => x.w);

let stars = "", buildings = "", windows = "", labels = "";
for (let i = 0; i < 70; i++) {
  const x = (rng() * W).toFixed(1), y = (8 + rng() * 120).toFixed(1), r = (0.4 + rng() * 1.1).toFixed(2);
  stars += `<circle class="star" cx="${x}" cy="${y}" r="${r}" style="animation-delay:${(rng() * 6).toFixed(2)}s;animation-duration:${(3 + rng() * 4).toFixed(2)}s"/>`;
}
const litDays = days.filter((d) => d.count > 0);
const order = new Map(litDays.map((d, i) => [d.date, i]));
for (let w = 0; w < WEEKS; w++) {
  const extra = weekTotals[w] ? Math.max(1, Math.round(MAX_EXTRA * Math.sqrt(weekTotals[w] / maxWeek))) : Math.round(rng() * 2);
  const floors = DAY_FLOORS + extra;
  const h = floors * FLOOR + 8, x = LEFT + w * step + (step - BW) / 2, y = GROUND - h;
  buildings += `<rect class="b" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${BW}" height="${h}"/>`;
  if (towers.includes(w)) {
    buildings += `<line class="mast" x1="${(x + BW / 2).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + BW / 2).toFixed(1)}" y2="${(y - 12).toFixed(1)}"/>`
      + `<circle class="beacon" cx="${(x + BW / 2).toFixed(1)}" cy="${(y - 13).toFixed(1)}" r="1.8" style="animation-delay:${(towers.indexOf(w) * 0.6).toFixed(1)}s"/>`;
  }
  const wx = x + (BW - WIN) / 2;
  // upper floors stay dark: only days with contributions light up
  for (let f = DAY_FLOORS; f < floors; f++) {
    const wy = GROUND - 6 - (f + 1) * FLOOR + WGAP;
    windows += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${WIN}" height="${WIN}" fill="#141920"/>`;
  }
  // the bottom seven floors are the week's days: Sunday on top, Saturday at street level
  for (const d of days.filter((dd) => dd.week === w)) {
    const wy = GROUND - 6 - (DAY_FLOORS - d.day) * FLOOR + WGAP;
    if (d.count > 0) {
      const delay = (0.4 + (order.get(d.date) / Math.max(1, litDays.length)) * 3.6).toFixed(2);
      windows += `<rect class="lit" x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${WIN}" height="${WIN}" fill="${LIT[Math.max(1, d.level)]}" style="animation-delay:${delay}s"><title>${d.count} on ${d.date}</title></rect>`;
    } else {
      windows += `<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${WIN}" height="${WIN}" fill="${LIT[0]}"/>`;
    }
  }
  // month names under the street, at the first week of each month
  // (the first week is labelled only if its month still has two weeks to go, so names never collide)
  const first = days.find((d) => d.week === w && d.date.endsWith("-01")) || (w === 0 && +days[0].date.slice(8) <= 14 ? days[0] : null);
  if (first) {
    const mon = new Date(first.date + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    labels += `<text class="mon" x="${(LEFT + w * step).toFixed(1)}" y="${GROUND + 18}">${mon}</text>`;
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
<title id="t">${USER}: ${total} contributions in the last year, drawn as a city at night</title>
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05080c"/><stop offset=".6" stop-color="#0d1117"/><stop offset="1" stop-color="#1c2128"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="#e6edf3" stop-opacity=".35"/><stop offset="1" stop-color="#e6edf3" stop-opacity="0"/></radialGradient>
  <filter id="bloom" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <mask id="crescent"><circle cx="812" cy="52" r="17" fill="#fff"/><circle cx="820" cy="46" r="15" fill="#000"/></mask>
</defs>
<style>
  .star { fill: #c9d1d9; animation: tw ease-in-out infinite; }
  @keyframes tw { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
  .b { fill: #0f141a; stroke: #1c2128; stroke-width: 1; }
  .mast { stroke: #30363d; stroke-width: 1.2; }
  .beacon { fill: #f85149; animation: blink 2.4s steps(1) infinite; }
  @keyframes blink { 0%,60% { opacity: 1 } 61%,100% { opacity: .15 } }
  .lit { animation: on .6s ease-out backwards; }
  @keyframes on { from { opacity: .08 } to { opacity: 1 } }
  .shoot { stroke: url(#tail); stroke-width: 1.4; stroke-linecap: round; opacity: 0; animation: shoot 11s ease-in 2s infinite; }
  @keyframes shoot { 0% { opacity: 0; transform: translate(0,0) } 2% { opacity: 1 } 9% { opacity: 0; transform: translate(-230px,90px) } 100% { opacity: 0; transform: translate(-230px,90px) } }
  .mon { fill: #6e7681; font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; }
  .cap { fill: #8b949e; font: 12px ui-monospace, SFMono-Regular, Consolas, monospace; }
  .cap b, .num { fill: #ffd56b; font-weight: 700; }
</style>
<rect width="${W}" height="${H}" rx="10" fill="url(#sky)"/>
${stars}
<linearGradient id="tail" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>
<line class="shoot" x1="560" y1="30" x2="610" y2="12"/>
<circle cx="812" cy="52" r="46" fill="url(#glow)"/>
<circle cx="812" cy="52" r="17" fill="#e6edf3" mask="url(#crescent)"/>
${buildings}
<g filter="url(#bloom)">${windows}</g>
<rect x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="#0b0f14"/>
<line x1="${LEFT}" y1="${GROUND + 0.5}" x2="${RIGHT}" y2="${GROUND + 0.5}" stroke="#30363d"/>
${labels}
<text class="cap" x="${LEFT}" y="${H - 16}"><tspan class="num">${total}</tspan> contributions in the last year · every lit window is a day I shipped something</text>
</svg>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`night-city: ${days.length} days, ${WEEKS} weeks, ${total} contributions, ${litDays.length} lit windows -> ${OUT}`);

// Generates stats.svg from live GitHub data. Runs in GitHub Actions (Node 20+).
// Languages are weighted PER REPO (each repo counts equally) so one large
// codebase doesn't drown out the rest. No dependencies.

const USER = "AkshobyaRaoSWE";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const H = { "User-Agent": "telemetry", Accept: "application/vnd.github+json", ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) };

const api = async (p) => {
  const r = await fetch("https://api.github.com" + p, { headers: H });
  if (!r.ok) throw new Error(`${p} -> ${r.status}`);
  return r.json();
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const user = await api(`/users/${USER}`);
const repos = (await api(`/users/${USER}/repos?per_page=100`)).filter((r) => !r.fork);

// per-repo-normalized language average
const acc = {};
let counted = 0;
for (const r of repos) {
  let langs = {};
  try { langs = await api(`/repos/${USER}/${r.name}/languages`); } catch { continue; }
  const tot = Object.values(langs).reduce((a, b) => a + b, 0);
  if (!tot) continue;
  counted++;
  for (const [k, v] of Object.entries(langs)) acc[k] = (acc[k] || 0) + v / tot;
}
const distinct = Object.keys(acc).length;
const top = Object.entries(acc)
  .map(([k, v]) => [k, (v / (counted || 1)) * 100])
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6);
const max = top.length ? top[0][1] : 1;

const repoCount = String(user.public_repos).padStart(2, "0");
const langCount = String(distinct).padStart(2, "0");

const rows = top.map(([name, pct], i) => {
  const y = 68 + i * 24, by = 76 + i * 24;
  const w = Math.max(6, Math.round((pct / max) * 404));
  return `      <text x="332" y="${by}" fill="#f3f1ea">${esc(name)}</text>
      <rect x="446" y="${y}" width="404" height="9" rx="4.5" fill="#ffffff" fill-opacity="0.07"/>
      <rect x="446" y="${y}" width="0" height="9" rx="4.5" fill="#ff4326"><animate attributeName="width" to="${w}" dur="1.1s" begin="${(0.1 + i * 0.08).toFixed(2)}s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1" values="0;${w}"/></rect>
      <text x="866" y="${by}" fill="#8c8c88" text-anchor="end">${Math.round(pct)}%</text>`;
}).join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 210" width="900" height="210" font-family="ui-monospace,'SF Mono','Roboto Mono',Menlo,monospace">
  <defs><clipPath id="rs"><rect width="900" height="210" rx="16"/></clipPath></defs>
  <g clip-path="url(#rs)">
    <rect width="900" height="210" fill="#0a0a0b"/>
    <rect x="0.5" y="0.5" width="899" height="209" rx="16" fill="none" stroke="#ffffff" stroke-opacity="0.12"/>
    <g stroke="#ffffff" stroke-opacity="0.04"><line x1="300" y1="0" x2="300" y2="210"/><line x1="0" y1="60" x2="900" y2="60"/></g>
    <circle cx="34" cy="36" r="4.5" fill="#ff4326"><animate attributeName="opacity" values="1;.3;1" dur="1.5s" repeatCount="indefinite"/></circle>
    <text x="48" y="40" font-size="12" letter-spacing="2.5" fill="#ff4326">GITHUB TELEMETRY</text>
    <text x="34" y="92" font-size="11" letter-spacing="2" fill="#5b5b58">REPOSITORIES</text>
    <text x="34" y="128" font-size="34" font-weight="bold" fill="#f3f1ea" font-family="'Helvetica Neue',Arial,sans-serif">${repoCount}</text>
    <text x="150" y="92" font-size="11" letter-spacing="2" fill="#5b5b58">LANGUAGES</text>
    <text x="150" y="128" font-size="34" font-weight="bold" fill="#f3f1ea" font-family="'Helvetica Neue',Arial,sans-serif">${langCount}</text>
    <text x="34" y="170" font-size="11" letter-spacing="2" fill="#5b5b58">STACK</text>
    <text x="34" y="190" font-size="14" fill="#f3f1ea">Full-stack &#43; C&#43;&#43; control</text>
    <text x="332" y="40" font-size="12" letter-spacing="2.5" fill="#ff4326">LANGUAGE SIGNAL</text>
    <text x="866" y="40" font-size="10.5" letter-spacing="1.5" fill="#5b5b58" text-anchor="end">// public repos</text>
    <g font-size="12">
${rows}
    </g>
  </g>
</svg>
`;

await import("node:fs").then((fs) => fs.writeFileSync("stats.svg", svg));
console.log(`stats.svg written: ${user.public_repos} repos, ${distinct} languages, top=${top.map((t) => t[0]).join(",")}`);

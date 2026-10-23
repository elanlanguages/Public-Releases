// Liste des applications affichées sur le site.
// - channel : tag de la release « canal de mise à jour » (toujours à jour)
// - notesTag : tag de la release versionnée, pour afficher les notes de version
const REPO = "elanlanguages/Public-Releases";

const APPS = [
  {
    id: "elan-chat",
    name: "ELAN Chat",
    description: "L'application de bureau ELAN Chat pour Windows.",
    channel: "elan-chat-latest",
    notesTag: (v) => `v${v}`,
    color: "#2563eb",
  },
  {
    id: "xtrf-for-windows",
    name: "XTRF for Windows",
    description: "XTRF dans une application Windows dédiée.",
    channel: "xtrf-for-windows-latest",
    notesTag: (v) => `xtrf-for-windows-v${v}`,
    color: "#0d9488",
  },
  {
    id: "swornfinder",
    name: "SwornFinder",
    description: "Recherche de traducteurs et interprètes jurés.",
    channel: "swornfinder-latest",
    notesTag: (v) => `swornfinder-v${v}`,
    color: "#9333ea",
  },
  {
    id: "xtrf-tools",
    name: "XTRF Tools",
    description: "Outils complémentaires pour XTRF.",
    channel: "xtrf-tools-latest",
    notesTag: (v) => `xtrf-tools-v${v}`,
    color: "#ea580c",
  },
];

const RELEASE_PAGE = (tag) => `https://github.com/${REPO}/releases/tag/${tag}`;

function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}

// Renvoie la liste des releases du dépôt (une seule requête à l'API GitHub).
async function fetchReleases() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

// Pour une application, trouve l'installateur le plus récent dans son canal.
function resolveApp(app, releases) {
  const channel = releases.find((r) => r.tag_name === app.channel);
  if (!channel) return null;

  const installers = channel.assets
    .map((a) => ({ asset: a, match: a.name.match(/-(\d+(?:\.\d+)+)\.exe$/i) }))
    .filter((x) => x.match)
    .map((x) => ({ ...x.asset, version: x.match[1] }))
    .sort((a, b) => compareVersions(b.version, a.version));
  if (!installers.length) return null;

  const latest = installers[0];
  const notes = releases.find((r) => r.tag_name === app.notesTag(latest.version));
  return {
    version: latest.version,
    url: latest.browser_download_url,
    size: latest.size,
    date: notes ? notes.published_at : latest.updated_at,
    notes: notes ? notes.body : "",
    notesUrl: notes ? notes.html_url : RELEASE_PAGE(app.channel),
  };
}

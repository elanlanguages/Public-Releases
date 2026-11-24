// Applications shown on the site.
// - channel: tag of the update-channel release (always current)
// - notesTag: tag of the versioned release, used for the release notes
// - icon: 128px PNG in docs/icons
// - screenshot: optional, shown on the tool's page (docs/screens)
// After editing this file, run `node site/build.mjs` (the workflow also does it) and bump ?v= in download.html.
const REPO = "elanlanguages/Public-Releases";

const APPS = [
  {
    id: "elan-chat",
    icon: "icons/elan-chat.png",
    name: "ELAN Chat",
    description: "ELAN’s AI chat assistant in its own Windows app, outside the browser.",
    channel: "elan-chat-latest",
    notesTag: (v) => `v${v}`,
    color: "#2563eb",
  },
  {
    id: "xtrf-for-windows",
    icon: "icons/xtrf-for-windows.png",
    name: "XTRF for Windows",
    description: "Opens XTRF in its own window, apart from your browser tabs.",
    channel: "xtrf-for-windows-latest",
    notesTag: (v) => `xtrf-for-windows-v${v}`,
    color: "#0d9488",
  },
  {
    id: "swornfinder",
    icon: "icons/swornfinder.png",
    name: "SwornFinder",
    description: "Find sworn translators and interpreters in Belgium, France, Germany and Poland.",
    screenshot: "screens/swornfinder.png",
    channel: "swornfinder-latest",
    notesTag: (v) => `swornfinder-v${v}`,
    color: "#9333ea",
  },
];

// Browser extensions, installed from their stores (which handle updates).
// A store with `channel` instead of `url` links to the newest .xpi in that release, and is hidden until one exists.
const EXTENSIONS = [
  {
    id: "xtrf-tools",
    icon: "icons/xtrf-tools.png",
    name: "XTRF Tools",
    description: "Browser extension for the XTRF Portal.",
    color: "#ea580c",
    stores: [
      { label: "Firefox", url: "https://addons.mozilla.org/firefox/addon/elan-xtrf-tools/" },
      { label: "Chrome / Edge", url: "https://chromewebstore.google.com/detail/chhckeiobgkakpafnhilnjinigmohkjo" },
    ],
  },
  {
    id: "in-house-tools",
    icon: "icons/in-house-tools.png",
    name: "In-House Tools",
    description: "Browser extension for in-house translators working in the Vendor Portal.",
    color: "#0284c7",
    stores: [
      { label: "Firefox", channel: "in-house-tools-latest" },
      { label: "Chrome / Edge", url: "https://chromewebstore.google.com/detail/kkhpodpjileamaaghgnmgmdfhoodadgc" },
    ],
  },
  {
    id: "plunet-tools",
    icon: "icons/plunet-tools.png",
    name: "Plunet Tools",
    description: "Browser extension for the Plunet portal.",
    color: "#4f46e5",
    stores: [
      { label: "Firefox", url: "https://addons.mozilla.org/firefox/addon/elan-plunet-tools/" },
      { label: "Chrome / Edge", url: "https://chromewebstore.google.com/detail/elan-plunet-tools/pnhleapohgjhemlbfghemnpjapnkahnl" },
    ],
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

// Returns the repository's releases: docs/releases.json (kept current by the
// "Update releases.json" workflow), or the GitHub API if that file is missing.
async function fetchReleases() {
  try {
    const local = await fetch("releases.json", { cache: "no-cache" });
    if (local.ok) return await local.json();
  } catch {}
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

// Finds the newest installer (.exe, or app.ext) in an application's update channel.
function resolveApp(app, releases) {
  const channel = releases.find((r) => r.tag_name === app.channel);
  if (!channel) return null;

  const installers = channel.assets
    .map((a) => ({ asset: a, match: a.name.match(new RegExp(String.raw`-(\d+(?:\.\d+)+)\.${app.ext || "exe"}$`, "i")) }))
    .filter((x) => x.match)
    .map((x) => ({ ...x.asset, version: x.match[1] }))
    .sort((a, b) => compareVersions(b.version, a.version));
  if (!installers.length) return null;

  const latest = installers[0];
  const notes = app.notesTag && releases.find((r) => r.tag_name === app.notesTag(latest.version));
  return {
    version: latest.version,
    url: latest.browser_download_url,
    size: latest.size,
    date: notes ? notes.published_at : latest.updated_at,
    notes: notes ? notes.body : "",
    notesUrl: notes ? notes.html_url : RELEASE_PAGE(app.channel),
  };
}

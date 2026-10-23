// Applications shown on the site.
// - channel: tag of the update-channel release (always current)
// - notesTag: tag of the versioned release, used for the release notes
// When editing this file, bump ?v= in index.html and download.html so browsers drop the cached copy.
const REPO = "elanlanguages/Public-Releases";

const APPS = [
  {
    id: "elan-chat",
    name: "ELAN Chat",
    description: "The ELAN Chat desktop app for Windows.",
    channel: "elan-chat-latest",
    notesTag: (v) => `v${v}`,
    color: "#2563eb",
  },
  {
    id: "xtrf-for-windows",
    name: "XTRF for Windows",
    description: "XTRF in a dedicated Windows app.",
    channel: "xtrf-for-windows-latest",
    notesTag: (v) => `xtrf-for-windows-v${v}`,
    color: "#0d9488",
  },
  {
    id: "swornfinder",
    name: "SwornFinder",
    description: "Find sworn translators and interpreters.",
    channel: "swornfinder-latest",
    notesTag: (v) => `swornfinder-v${v}`,
    color: "#9333ea",
  },
];

// Browser extensions, installed from their stores (which handle updates).
const EXTENSIONS = [
  {
    id: "xtrf-tools",
    name: "XTRF Tools",
    description: "Browser extension that enhances XTRF for ELAN Languages employees.",
    color: "#ea580c",
    stores: [
      { label: "Firefox", url: "https://addons.mozilla.org/firefox/addon/elan-xtrf-tools/" },
      { label: "Chrome / Edge", url: "https://chromewebstore.google.com/detail/chhckeiobgkakpafnhilnjinigmohkjo" },
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

// Returns the repository's releases (a single GitHub API request).
async function fetchReleases() {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return res.json();
}

// Finds the newest installer in an application's update channel.
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

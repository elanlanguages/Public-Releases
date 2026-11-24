// Builds the download site from docs/apps.js and docs/releases.json:
// docs/index.html and one page per tool in docs/tools/.
// Run with `node site/build.mjs`; the "Update releases.json" workflow runs it too.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { runInNewContext } from "node:vm";

const docs = new URL("../docs/", import.meta.url);
const read = (p) => readFileSync(new URL(p, docs), "utf8");
const write = (p, s) => writeFileSync(new URL(p, docs), s);

const { APPS, EXTENSIONS, REPO, RELEASE_PAGE, resolveApp } = runInNewContext(
  read("apps.js") + "\n;({ APPS, EXTENSIONS, REPO, RELEASE_PAGE, resolveApp })",
);
const releases = existsSync(new URL("releases.json", docs)) ? JSON.parse(read("releases.json")) : [];
const RELEASES_URL = `https://github.com/${REPO}/releases`;

// ---------- helpers ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const formatDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const formatSize = (b) => `${Math.round(b / 1048576)} MB`;

// Minimal Markdown for release notes: lists, bold, code, links.
function markdown(md) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  let html = "", inList = false;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    const item = line.match(/^[-*]\s+(.*)/);
    if (item) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(item[1])}</li>`;
      continue;
    }
    if (inList) { html += "</ul>"; inList = false; }
    if (line) html += `<p>${inline(line.replace(/^#+\s*/, ""))}</p>`;
  }
  return html + (inList ? "</ul>" : "");
}

// Every versioned release of an app, newest first.
function history(app) {
  if (!app.notesTag) return [];
  const prefix = app.notesTag("");
  return releases
    .filter((r) => r.tag_name.startsWith(prefix) && /^\d+(\.\d+)+$/.test(r.tag_name.slice(prefix.length)))
    .map((r) => ({ version: r.tag_name.slice(prefix.length), date: r.published_at, notes: r.body || "", url: r.html_url }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function storeLinks(ext) {
  return ext.stores
    .map((s) => (s.url ? s : { ...s, url: resolveApp({ channel: s.channel, ext: "xpi" }, releases)?.url }))
    .filter((s) => s.url)
    .map((s) => ({ ...s, kind: s.label === "Firefox" ? "firefox" : "chromium" }))
    .sort((a, b) => (a.kind === "chromium" ? -1 : 1) - (b.kind === "chromium" ? -1 : 1));
}

const ICON_DOWNLOAD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>';
const ICON_LINK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';

const FAVICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='white'/><path d='M7 9h18M7 16h18M7 23h18' stroke='%2300a2e1' stroke-width='4' stroke-linecap='round'/></svg>`;

// ---------- pieces ----------

function page({ root, title, description, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="icon" href="${FAVICON}">
  <link rel="preconnect" href="https://api.fontshare.com">
  <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${root}site.css">
</head>
<body>
  <header class="nav container">
    <a class="wordmark" href="${root}">ELAN Languages</a>
    <nav aria-label="Sections">
      <a href="${root}#extensions">Browser extensions</a>
      <a href="${root}#apps">Windows apps</a>
    </nav>
  </header>
${body}
  <footer class="foot">
    <div class="container foot__inner">
      <p class="foot__mark">ELAN Languages</p>
      <p>Every download comes from the <a href="${RELEASES_URL}">ELAN releases on GitHub</a>.</p>
    </div>
  </footer>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="${root}site.js"></script>
</body>
</html>
`;
}

const logo = (item, size, root = "") => `<img class="tool-icon" src="${root}${item.icon}" width="${size}" height="${size}" alt="">`;

function appActions(app, info, root) {
  return `<a class="btn btn--ink" href="${info.url}">${ICON_DOWNLOAD} Download <span class="fig btn__size">${formatSize(info.size)}</span></a>
          <button class="btn btn--card" type="button" data-copy="${root}download.html?app=${app.id}">${ICON_LINK} Copy link</button>`;
}

function storeActions(stores) {
  return stores.map((s, i) => `<a class="btn ${i ? "btn--card" : "btn--ink"}" data-store="${s.kind}" href="${s.url}">${ICON_DOWNLOAD} Add to ${esc(s.label)}</a>`).join("\n          ");
}

// ---------- index ----------

const apps = APPS.map((app) => ({ app, info: resolveApp(app, releases) })).filter((x) => x.info);
const extensions = EXTENSIONS.map((ext) => ({ ext, stores: storeLinks(ext) }));

const deskCards = [
  ...apps.map(({ app, info }) => ({ item: app, line: `<span class="fig">v${info.version}</span> for Windows` })),
  ...extensions.map(({ ext }) => ({ item: ext, line: "Browser extension" })),
].map(({ item, line }) => `
        <li><a class="index-card" href="tools/${item.id}.html">
          ${logo(item, 48)}
          <span class="index-card__name">${esc(item.name)}</span>
          <span class="index-card__line">${line}</span>
        </a></li>`).join("");

const extRows = extensions.map(({ ext, stores }) => `
        <li class="row" id="${ext.id}">
          ${logo(ext, 56)}
          <div class="row__text">
            <h3><a href="tools/${ext.id}.html">${esc(ext.name)}</a></h3>
            <p>${esc(ext.description)}</p>
          </div>
          <div class="row__actions">
          ${storeActions(stores)}
          </div>
        </li>`).join("");

const appRows = apps.map(({ app, info }) => `
        <li class="row" id="${app.id}">
          ${logo(app, 56)}
          <div class="row__text">
            <h3><a href="tools/${app.id}.html">${esc(app.name)}</a></h3>
            <p>${esc(app.description)}</p>
            <p class="row__meta"><span class="fig">v${info.version}</span><span>Updated ${formatDate(info.date)}</span></p>
          </div>
          <div class="row__actions">
          ${appActions(app, info, "")}
          </div>${info.notes ? `
          <details class="row__notes">
            <summary>What’s new in ${info.version}</summary>
            <div class="notes">${markdown(info.notes)}</div>
          </details>` : ""}
        </li>`).join("");

const featured = APPS.find((a) => a.screenshot && apps.some((x) => x.app === a));

write("index.html", page({
  root: "",
  title: "ELAN Apps and Extensions",
  description: "Windows apps and browser extensions made by ELAN Languages.",
  body: `
  <main>
    <section class="desk">
      <div class="container desk__inner">
        <div class="desk__text">
          <h1>Tools for working at ELAN</h1>
          <p class="lead">Install a tool once and it keeps itself up to date.</p>
          <div class="actions">
            <a class="btn btn--ink" href="#apps">See Windows apps</a>
            <a class="btn btn--card" href="#extensions">See browser extensions</a>
          </div>
        </div>
        <ul class="index-cards" aria-label="All tools">${deskCards}
        </ul>
      </div>
    </section>

    <section class="block container" id="extensions" aria-labelledby="extensions-head">
      <div class="block__head">
        <h2 id="extensions-head">Browser extensions</h2>
        <p>Add them from your browser’s store, which keeps them updated.</p>
      </div>
      <ul class="sheet">${extRows}
      </ul>
    </section>

    <section class="block container" id="apps" aria-labelledby="apps-head">
      <div class="block__head">
        <h2 id="apps-head">Windows apps</h2>
        <p>Run the installer once; the app then updates itself.</p>
      </div>
      ${apps.length ? `<ul class="sheet">${appRows}
      </ul>` : `<p class="sheet sheet--empty">The installers could not be listed. <a href="${RELEASES_URL}">See all downloads on GitHub</a>.</p>`}
    </section>
${featured ? `
    <section class="block container shot" aria-labelledby="shot-head">
      <div class="block__head">
        <h2 id="shot-head">${esc(featured.name)}, as it opens</h2>
        <p>${esc(featured.description)} <a href="tools/${featured.id}.html">More about ${esc(featured.name)}</a></p>
      </div>
      <figure class="shot__frame" data-kind="product">
        <img src="${featured.screenshot}" width="1917" height="940" alt="${esc(featured.name)} start screen" loading="lazy">
      </figure>
    </section>` : ""}
  </main>`,
}));

// ---------- tool pages ----------

mkdirSync(new URL("tools/", docs), { recursive: true });

for (const { app, info } of apps) {
  const versions = history(app);
  write(`tools/${app.id}.html`, page({
    root: "../",
    title: `${app.name} - ELAN Languages`,
    description: app.description,
    body: `
  <main>
    <section class="desk desk--tool">
      <div class="container tool-head">
        ${logo(app, 96, "../")}
        <div>
          <h1>${esc(app.name)}</h1>
          <p class="lead">${esc(app.description)}</p>
          <p class="row__meta"><span class="fig">v${info.version}</span><span>Updated ${formatDate(info.date)}</span><span>Windows</span></p>
          <div class="actions">
          ${appActions(app, info, "../")}
          </div>
        </div>
      </div>
    </section>
${app.screenshot ? `
    <section class="block container shot">
      <figure class="shot__frame" data-kind="product">
        <img src="../${app.screenshot}" width="1917" height="940" alt="${esc(app.name)} start screen">
      </figure>
    </section>` : ""}
    <section class="block container" aria-labelledby="history-head">
      <div class="block__head">
        <h2 id="history-head">Version history</h2>
        <p>Run the installer once; the app then updates itself to each new version.</p>
      </div>
      ${versions.length ? `<ol class="sheet history">${versions.map((v, i) => `
        <li class="history__item">
          <p class="history__when"><span class="fig">v${v.version}</span><span>${formatDate(v.date)}</span></p>
          ${i === 0 ? `<div class="notes">${markdown(v.notes) || "<p>No notes for this version.</p>"}</div>` : `<details><summary>What changed</summary><div class="notes">${markdown(v.notes) || "<p>No notes for this version.</p>"}</div></details>`}
        </li>`).join("")}
      </ol>` : `<p class="sheet sheet--empty"><a href="${RELEASE_PAGE(app.channel)}">See the releases on GitHub</a>.</p>`}
    </section>
  </main>`,
  }));
}

for (const { ext, stores } of extensions) {
  write(`tools/${ext.id}.html`, page({
    root: "../",
    title: `${ext.name} - ELAN Languages`,
    description: ext.description,
    body: `
  <main>
    <section class="desk desk--tool">
      <div class="container tool-head">
        ${logo(ext, 96, "../")}
        <div>
          <h1>${esc(ext.name)}</h1>
          <p class="lead">${esc(ext.description)}</p>
          <p class="row__meta"><span>Your browser’s store keeps it up to date.</span></p>
          <div class="actions">
          ${storeActions(stores)}
          </div>
        </div>
      </div>
    </section>
  </main>`,
  }));
}

console.log(`built index.html and ${apps.length + extensions.length} tool pages`);

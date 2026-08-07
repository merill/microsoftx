#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/diff-config');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');
const canonicalRoot = 'https://microsoftx.com';

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function write(relativePath, content) {
  const target = path.join(distDir, relativePath);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, content);
}

function copy(source, relativeTarget) {
  const target = path.join(distDir, relativeTarget);
  ensureDir(path.dirname(target));
  fs.copyFileSync(source, target);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}

const icons = {
  sunMoon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>'
};

function navigation(current) {
  const links = [
    ['home', '/', 'Home'],
    ['about', '/about/', 'About'],
    ['supported', '/supported/', 'Supported'],
    ['privacy', '/privacy/', 'Privacy']
  ];
  return `<nav class="site-nav" data-site-nav aria-label="Primary navigation">
    ${links.map(([id, href, label]) => `<a href="${canonicalRoot}${href}"${current === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    <a href="https://github.com/merill/microsoftx" target="_blank" rel="noopener noreferrer">GitHub</a>
  </nav>`;
}

function header(current) {
  return `<a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="independent-bar">Independent community tool — not affiliated with Microsoft</div>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${canonicalRoot}/" aria-label="MicrosoftX home"><img class="brand-logo" src="/assets/branding/microsoftx-icon-64.png" alt=""><span>MicrosoftX</span><small>Documentation changes</small></a>
      ${navigation(current)}
      <button class="header-action menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-label="Open navigation">${icons.menu}</button>
      <button class="header-action" type="button" data-theme-toggle aria-label="Change color theme">${icons.sunMoon}</button>
      ${current === 'home' ? `<button class="header-action" type="button" data-token-open aria-label="GitHub API settings" title="GitHub API settings">${icons.gear}</button>` : ''}
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer">
    <div class="footer-inner">
      <section class="footer-about"><a class="brand" href="${canonicalRoot}/"><img class="brand-logo" src="/assets/branding/microsoftx-icon-64.png" alt=""><span>MicrosoftX</span></a><p>Add one letter to a Microsoft Learn domain and see the latest documentation change. Built for the community by Merill Fernando.</p></section>
      <nav class="footer-links" aria-label="Explore"><h2>Explore</h2><a href="${canonicalRoot}/">Home</a><a href="${canonicalRoot}/about/">About</a><a href="${canonicalRoot}/supported/">Supported documentation</a><a href="${canonicalRoot}/privacy/">Privacy</a></nav>
      <nav class="footer-links" aria-label="Project"><h2>Project</h2><a href="https://github.com/merill/microsoftx">Source on GitHub</a><a href="https://github.com/merill/microsoftx/issues">Report an issue</a><a href="https://merill.net">merill.net</a><a href="https://daily.entra.news">Daily.Entra.News</a></nav>
    </div>
    <div class="footer-bottom">© 2026 Merill Fernando. Microsoft Learn and Microsoft product names are trademarks of Microsoft Corporation.</div>
  </footer>`;
}

function tokenDialog() {
  return `<dialog class="token-dialog" data-token-dialog aria-labelledby="token-dialog-title">
    <div class="token-dialog-head"><div><span class="eyebrow">Optional browser setting</span><h2 id="token-dialog-title">GitHub API access</h2></div><button class="dialog-close" type="button" data-token-close aria-label="Close">×</button></div>
    <div class="token-dialog-body">
      <p>MicrosoftX reads public documentation history from GitHub. Anonymous access normally works without setup. Add a token only if GitHub asks you to.</p>
      <label for="github-token">Fine-grained GitHub token</label>
      <input id="github-token" data-token-input type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
      <div class="dialog-actions"><button class="button-primary" type="button" data-token-save>Save in this browser</button><button class="button-secondary" type="button" data-token-remove>Remove</button></div>
      <p class="token-status" data-token-status role="status" aria-live="polite"></p>
      <p class="token-warning">The token is stored in localStorage and sent only to <code>api.github.com</code>. Use a short expiration and no repository permissions for public documentation.</p>
    </div>
  </dialog>`;
}

function pageLayout({ title, description, pathName, current, breadcrumbs, content, extraScripts = '', bodyAttributes = '' }) {
  const canonical = `${canonicalRoot}${pathName}`;
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MicrosoftX">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${canonicalRoot}/assets/branding/microsoftx-logo.png">
  <meta property="og:image:width" content="1254">
  <meta property="og:image:height" content="1254">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${canonicalRoot}/assets/branding/microsoftx-logo.png">
  <meta name="theme-color" content="#0067b8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/branding/favicon-32.png" type="image/png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/branding/microsoftx-icon-192.png">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="/assets/site.css">
  <script src="/assets/theme-bootstrap.js"></script>
</head>
<body ${bodyAttributes}>
  <div itemscope itemtype="https://schema.org/WebSite"><meta itemprop="name" content="MicrosoftX"><meta itemprop="url" content="${canonicalRoot}/"></div>
  ${header(current)}
  ${breadcrumbs || ''}
  ${content}
  ${footer()}
  ${tokenDialog()}
  <script src="/assets/site.js"></script>
  ${extraScripts}
</body>
</html>`;
}

function breadcrumbs(label) {
  return `<nav class="page-shell breadcrumbs" aria-label="Breadcrumb"><a href="${canonicalRoot}/">MicrosoftX</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(label)}</span></nav>`;
}

function sideNav(current) {
  return `<nav class="side-nav" aria-label="MicrosoftX documentation"><strong>MicrosoftX</strong><a href="${canonicalRoot}/about/"${current === 'about' ? ' aria-current="page"' : ''}>About</a><a href="${canonicalRoot}/supported/"${current === 'supported' ? ' aria-current="page"' : ''}>Supported docs</a><a href="${canonicalRoot}/privacy/"${current === 'privacy' ? ' aria-current="page"' : ''}>Privacy</a></nav>`;
}

function contentPage({ current, title, lede, sections, aside = '' }) {
  return `<main class="page-shell content-layout" id="main-content">
    ${sideNav(current)}
    <article class="content-main"><span class="eyebrow">MicrosoftX documentation</span><h1>${title}</h1><p class="content-lede">${lede}</p>${sections}</article>
    <aside class="page-toc">${aside}</aside>
  </main>`;
}

function diffApplication() {
  return `<main class="diff-page" data-diff-page hidden>
    <section class="diff-hero">
      <div><span class="eyebrow">Client-side documentation explorer</span><h1>See what changed.</h1><p>MicrosoftX maps this Learn article to its public GitHub source and compares the latest two revisions in your browser.</p></div>
      <form class="compare-form" data-diff-form>
        <label for="learn-url">Microsoft Learn article URL</label>
        <div class="url-form"><input id="learn-url" name="learn-url" type="url" inputmode="url" autocomplete="url" required placeholder="https://learn.microsoft.com/en-us/entra/…"><button class="button-primary" type="submit">Compare latest change</button></div>
        <div class="compare-status" data-compare-status role="status" aria-live="polite" hidden></div>
        <div class="rate-actions" data-rate-actions hidden><button class="button-secondary" type="button" data-token-open>Open API settings</button><a href="${canonicalRoot}/privacy/">How browser access works</a></div>
      </form>
    </section>
    <aside class="diff-intro" data-diff-intro><strong>Supported Microsoft Learn areas</strong><p>Entra, Azure, Microsoft Graph, .NET, PowerShell, Microsoft 365, Intune, Fabric, Dynamics 365, SQL, Visual Studio, ASP.NET Core, and Windows Server.</p><a href="${canonicalRoot}/supported/">View mappings and limitations</a></aside>
    <article data-compare-results hidden>
      <header class="result-head"><div><span class="eyebrow" data-result-source>Documentation source</span><h2 data-result-title></h2><code class="result-path" data-result-path></code></div><nav class="source-links" aria-label="Source links"><a data-result-learn target="_blank" rel="noopener noreferrer">Microsoft Learn ↗</a><a data-result-github target="_blank" rel="noopener noreferrer">GitHub source ↗</a><a data-result-history target="_blank" rel="noopener noreferrer">File history ↗</a></nav></header>
      <div class="revision-grid" data-result-revisions></div>
      <section class="diff-content" data-diff-content><header class="diff-heading"><div><span class="eyebrow">Browser-generated comparison</span><h2>What changed</h2></div><p data-result-stats></p></header><div class="diff-tabs" role="tablist"><button class="active" type="button" role="tab" aria-selected="true" data-diff-tab="formatted">Visual diff</button><button type="button" role="tab" aria-selected="false" data-diff-tab="markdown">Markdown diff</button></div><div class="diff-panel" role="tabpanel" data-diff-panel="formatted" data-visual-diff></div><div class="diff-panel" role="tabpanel" data-diff-panel="markdown" data-markdown-diff hidden></div></section>
    </article>
    <nav class="diff-navigator" data-diff-navigator aria-label="Navigate changes" hidden><span data-diff-position>Changes</span><button type="button" data-diff-previous aria-label="Previous change">← Previous</button><button type="button" data-diff-next aria-label="Next change">Next →</button></nav>
  </main>`;
}

function homePage() {
  const products = [...new Set(config.sources.map(source => source.label))];
  const productCards = products.map(label => `<a class="product-card" href="${canonicalRoot}/supported/#${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><strong>${escapeHtml(label)}</strong><span>View source mapping →</span></a>`).join('');
  const marketing = `<main data-marketing-root id="main-content" itemscope itemtype="https://schema.org/SoftwareApplication">
    <meta itemprop="name" content="MicrosoftX"><meta itemprop="applicationCategory" content="DeveloperApplication"><meta itemprop="operatingSystem" content="Any modern web browser"><meta itemprop="url" content="${canonicalRoot}/">
    <section class="hero"><div class="hero-inner"><span class="eyebrow">Microsoft Learn page diffs</span><h1>Add an <span class="x-accent">x</span>.<br>See what changed.</h1><p class="lede" itemprop="description">Turn any supported Microsoft Learn article into a readable documentation diff by adding one letter to the domain.</p><div class="button-row"><a class="button-primary" href="#try-it">Try a Learn URL</a><a class="button-secondary" href="${canonicalRoot}/about/">Why I built this</a></div></div></section>
    <section class="shortcut-demo" aria-labelledby="demo-title"><div class="browser-chrome"><span class="browser-dots" aria-hidden="true"><i></i><i></i><i></i></span><div class="address-bar">https://learn.microsoft<mark>x</mark>.com/en-us/entra/identity/...</div></div><div class="demo-body"><span class="eyebrow">The one-letter shortcut</span><div class="demo-flow"><div class="demo-step"><strong id="demo-title">1. Start on Microsoft Learn</strong><code>learn.microsoft.com/en-us/entra/...</code></div><span class="demo-arrow" aria-hidden="true">→</span><div class="demo-step"><strong>2. Add x after Microsoft</strong><code>learn.microsoft<span class="x-accent">x</span>.com/en-us/entra/...</code></div></div></div></section>
    <section class="section" aria-labelledby="how-heading"><div class="section-heading"><span class="eyebrow">How it works</span><h2 id="how-heading">The source evidence stays close.</h2><p>MicrosoftX does not copy or maintain Microsoft documentation. It finds the public source file and reads its Git history directly.</p></div><div class="feature-grid"><article class="feature-card"><span class="feature-number">1</span><h3>Recognize the article</h3><p>The Learn path is matched against a transparent list of supported public documentation repositories.</p></article><article class="feature-card"><span class="feature-number">2</span><h3>Load two revisions</h3><p>Your browser requests the latest two commits that changed that Markdown file from GitHub.</p></article><article class="feature-card"><span class="feature-number">3</span><h3>Build the diff locally</h3><p>The visual and Markdown comparisons are generated on your device. There is no MicrosoftX application server.</p></article></div></section>
    <section class="section" id="try-it" aria-labelledby="try-heading"><div class="section-heading"><span class="eyebrow">Try it</span><h2 id="try-heading">Paste once, then remember the x.</h2><p>Use the form as a fallback. MicrosoftX will send you to the matching <code>learn.microsoftx.com</code> shortcut URL.</p></div><form data-home-url-form><div class="url-form"><input name="url" type="url" required inputmode="url" autocomplete="url" aria-label="Microsoft Learn article URL" placeholder="https://learn.microsoft.com/en-us/entra/identity/authentication/..."><button class="button-primary" type="submit">View latest diff</button></div><p class="form-help">Only public, configured Microsoft Learn documentation is supported.</p><div class="compare-status" data-home-url-status role="status" aria-live="polite" hidden></div></form></section>
    <section class="section" aria-labelledby="supported-heading"><div class="section-heading"><span class="eyebrow">Supported documentation</span><h2 id="supported-heading">Built around public source repositories.</h2><p>The initial source list covers ${products.length} Microsoft Learn product areas and can grow through reviewed mapping updates.</p></div><div class="product-grid">${productCards}</div><p><a href="${canonicalRoot}/supported/">See repositories, branches, and examples →</a></p></section>
    <section class="section" aria-labelledby="privacy-heading"><div class="privacy-callout">${icons.lock}<div><h3 id="privacy-heading">Private by architecture</h3><p>Your article URL and optional GitHub token stay in your browser. MicrosoftX has no API, user database, or shared GitHub credential. <a href="${canonicalRoot}/privacy/">Read the privacy details</a>.</p></div></div></section>
    <section class="section" itemscope itemtype="https://schema.org/FAQPage"><div class="section-heading"><span class="eyebrow">Frequently asked questions</span><h2>What to know before using MicrosoftX.</h2></div><div class="faq">
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">Is MicrosoftX an official Microsoft site?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">No. MicrosoftX is an independent community project. It links back to Microsoft Learn and the public GitHub source for every comparison.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">Does it support every Microsoft Learn page?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Not yet. The supported list focuses on product areas with reliable public URL-to-repository mappings. Unsupported pages show a clear explanation instead of guessing.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">What revisions are compared?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">By default, MicrosoftX compares the latest two Git commits that affected the mapped Markdown file.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">Do I need a GitHub token?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Usually not. Anonymous GitHub access works first. MicrosoftX only suggests an optional token if GitHub reports that its anonymous API limit has been exhausted.</p></div></details>
    </div></section>
  </main>`;
  return pageLayout({
    title: 'MicrosoftX — Add an x. See what changed.',
    description: 'Add one letter to a supported Microsoft Learn URL to see the latest documentation change as a visual and Markdown diff.',
    pathName: '/',
    current: 'home',
    content: `${marketing}${diffApplication()}`,
    bodyAttributes: 'class="home-page"',
    extraScripts: '<script src="/assets/diff-config.js"></script><script src="/assets/vendor/marked.js"></script><script src="/assets/vendor/diff.min.js"></script><script src="/assets/vendor/htmldiff.js"></script><script src="/assets/diff-app.js"></script>'
  });
}

function aboutPage() {
  const sections = `<h2 id="why">Why it exists</h2><p>Microsoft Learn pages evolve every day. Guidance is clarified, previews become generally available, screenshots change, and recommendations are rewritten. Once a page is updated, the previous wording is easy to miss unless you already know where its source lives and how to read Git history.</p><p>I built MicrosoftX to make that history feel like part of browsing the documentation. If you can add one letter to a domain, you can see the latest change and decide whether it matters to you.</p>
  <h2 id="works">How it works</h2><p>MicrosoftX translates a supported Learn path into its public GitHub repository and Markdown path. Your browser asks GitHub for the latest two commits that touched that file, downloads those two revisions, sanitizes the rendered content, and builds both a readable visual diff and a raw Markdown patch.</p><p>There is no MicrosoftX backend in that flow. The source mapping is checked into the public project, and the comparison happens entirely in your browser.</p>
  <h2 id="community">Made for the community</h2><p>This is an independent project for administrators, architects, developers, writers, and curious people who notice small documentation changes and want to understand why they matter.</p><blockquote><p>MicrosoftX is not a Microsoft product or service. Microsoft Learn remains the canonical documentation source, and every diff links back to the original page and public repository evidence.</p></blockquote><p>If a mapping is missing or wrong, <a href="https://github.com/merill/microsoftx/issues">open an issue on GitHub</a>. Clear examples and community contributions are welcome.</p>
  <h2 id="builder">Built by Merill</h2><div class="author-card"><div class="author-avatar" aria-hidden="true">MF</div><div><h3>Merill Fernando</h3><p>Merill builds community tools and writes about Microsoft Entra and Microsoft 365. MicrosoftX grew from the page-diff explorer in Daily.Entra.News.</p><a href="https://merill.net">Visit merill.net →</a></div></div>`;
  return pageLayout({ title: 'About MicrosoftX', description: 'Why Merill Fernando built MicrosoftX and how the browser-only Microsoft Learn page diff works.', pathName: '/about/', current: 'about', breadcrumbs: breadcrumbs('About'), content: contentPage({ current: 'about', title: 'About MicrosoftX', lede: 'Built for people who want to know what changed—not only what the documentation says today.', sections, aside: '<strong>In this article</strong><br><a href="#why">Why it exists</a><br><a href="#works">How it works</a><br><a href="#community">Community</a><br><a href="#builder">Built by Merill</a>' }) });
}

function supportedPage() {
  const grouped = [];
  const seen = new Set();
  for (const source of config.sources) {
    const key = `${source.label}|${source.repositoryUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    grouped.push(source);
  }
  const rows = grouped.map(source => {
    const anchor = source.label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const repo = new URL(source.repositoryUrl).pathname.replace(/^\//, '');
    const exampleSuffix = {
      'Microsoft Entra': 'en-us/entra/identity/conditional-access/overview',
      'Azure': 'en-us/azure/azure-functions/functions-overview',
      '.NET': 'en-us/dotnet/core/introduction',
      'PowerShell': 'en-us/powershell/scripting/overview',
      'Microsoft 365': 'en-us/microsoft-365/admin/setup/setup',
      'Microsoft Intune': 'en-us/mem/intune/fundamentals/what-is-intune',
      'Microsoft Fabric': 'en-us/fabric/get-started/microsoft-fabric-overview',
      'Dynamics 365': 'en-us/dynamics365/get-started/intro-crossapp-index',
      'SQL': 'en-us/sql/sql-server/what-s-new-in-sql-server-2025',
      'Microsoft Graph': 'en-us/graph/overview',
      'Visual Studio': 'en-us/visualstudio/ide/whats-new-visual-studio-2022',
      'ASP.NET Core': 'en-us/aspnet/core/introduction-to-aspnet-core',
      'Windows Server': 'en-us/windows-server/get-started/overview'
    }[source.label];
    return `<tr id="${anchor}"><th scope="row">${escapeHtml(source.label)}</th><td><a href="${escapeHtml(source.repositoryUrl)}">${escapeHtml(repo)}</a></td><td><code>${escapeHtml(source.defaultBranch)}</code></td><td><a href="https://learn.microsoftx.com/${exampleSuffix}">Try example ↗</a></td></tr>`;
  }).join('');
  const sections = `<h2 id="areas">Supported product areas</h2><p>MicrosoftX uses an ordered, reviewed configuration rather than guessing. Narrow routes such as Microsoft Graph API versions and Fabric get-started pages are matched before broader product routes.</p><div class="table-scroll"><table class="repo-table"><thead><tr><th>Learn area</th><th>Public source repository</th><th>Branch</th><th>Example</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2 id="mapping">How URL mapping works</h2><p>A leading locale such as <code>en-us</code> or <code>fr-fr</code> is removed for repository lookup. The configured Learn prefix is replaced with a repository path prefix, and the article slug becomes a Markdown filename.</p><p>For example, <code>/en-us/entra/identity/conditional-access/overview</code> maps to <code>docs/identity/conditional-access/overview.md</code> in <code>MicrosoftDocs/entra-docs</code>.</p><p>Query-specific mappings are supported. Microsoft Graph’s <code>?view=graph-rest-beta</code> selects the beta API source tree, while <code>graph-rest-1.0</code> selects v1.0.</p>
  <h2 id="limits">Limitations</h2><ul><li>Some Learn pages are generated, private, moved, or sourced through nonstandard publishing pipelines.</li><li>A public URL does not always have a one-to-one public Markdown file.</li><li>MicrosoftX compares Git revisions, not changes introduced by runtime Learn rendering or personalization.</li><li>Repository moves can temporarily break a mapping until the configuration is updated.</li></ul><p>Unsupported paths fail explicitly and link back to the original Learn page. To request a mapping, <a href="https://github.com/merill/microsoftx/issues">open an issue with an example URL</a>.</p>`;
  return pageLayout({ title: 'Supported Microsoft Learn documentation — MicrosoftX', description: 'Microsoft Learn product areas, public GitHub repositories, branches, examples, and mapping limitations supported by MicrosoftX.', pathName: '/supported/', current: 'supported', breadcrumbs: breadcrumbs('Supported documentation'), content: contentPage({ current: 'supported', title: 'Supported documentation', lede: 'Reliable page diffs begin with transparent, testable mappings to public source repositories.', sections, aside: '<strong>In this article</strong><br><a href="#areas">Product areas</a><br><a href="#mapping">URL mapping</a><br><a href="#limits">Limitations</a>' }) });
}

function privacyPage() {
  const sections = `<h2 id="browser">What stays in your browser</h2><p>The page comparison is performed by JavaScript downloaded as part of the static MicrosoftX site. MicrosoftX has no application server, account system, database, or shared GitHub credential.</p><p>The Microsoft Learn URL you enter is used locally to select a configured public repository and source path.</p>
  <h2 id="github">Requests to GitHub</h2><p>Your browser contacts <code>api.github.com</code> to obtain public commit metadata and Markdown revisions. Relative documentation images can be loaded from <code>raw.githubusercontent.com</code>. GitHub receives the normal network information associated with those requests, including your IP address.</p><p>MicrosoftX does not proxy these requests or receive their contents.</p>
  <h2 id="token">Optional GitHub token</h2><p>Anonymous access is used first. If GitHub reports that its anonymous API allowance is exhausted, MicrosoftX can store an optional fine-grained token in this browser’s <code>localStorage</code>.</p><ul><li>The token is added only to HTTPS requests whose hostname is exactly <code>api.github.com</code>.</li><li>It is never added to image requests, analytics, external links, or requests to MicrosoftX.</li><li>You can remove it at any time from API settings.</li><li>Use the shortest practical expiry and no repository permissions for public documentation.</li></ul>
  <h2 id="hosting">Static hosting and logs</h2><p>Cloudflare Pages serves the site’s static files and may process standard web-server information according to Cloudflare’s service operation and your network settings. MicrosoftX does not add a custom analytics or tracking service in the initial release.</p>
  <h2 id="control">Your controls</h2><p>Clear the optional token through API settings or your browser’s site-data controls. You can also inspect the complete client implementation on <a href="https://github.com/merill/microsoftx">GitHub</a>.</p>`;
  return pageLayout({ title: 'Privacy — MicrosoftX', description: 'How MicrosoftX performs documentation diffs in your browser, contacts GitHub, and handles an optional locally stored token.', pathName: '/privacy/', current: 'privacy', breadcrumbs: breadcrumbs('Privacy'), content: contentPage({ current: 'privacy', title: 'Privacy by architecture', lede: 'MicrosoftX is a static site. Article mapping, GitHub requests, and diff generation happen in your browser.', sections, aside: '<strong>In this article</strong><br><a href="#browser">In your browser</a><br><a href="#github">GitHub requests</a><br><a href="#token">Optional token</a><br><a href="#hosting">Static hosting</a><br><a href="#control">Your controls</a>' }) });
}

function thirdPartyLicenses() {
  const packages = [
    ['marked', 'LICENSE.md'],
    ['diff', 'LICENSE'],
    ['node-htmldiff', 'LICENSE']
  ];
  return packages.map(([name, license]) => `${name}\n${'='.repeat(name.length)}\n${fs.readFileSync(path.join(rootDir, 'node_modules', name, license), 'utf8').trim()}\n`).join('\n');
}

function build() {
  fs.rmSync(distDir, { recursive: true, force: true });
  ensureDir(distDir);

  write('index.html', homePage());
  write('about/index.html', aboutPage());
  write('supported/index.html', supportedPage());
  write('privacy/index.html', privacyPage());
  copy(path.join(srcDir, 'site.css'), 'assets/site.css');
  copy(path.join(srcDir, 'site.js'), 'assets/site.js');
  copy(path.join(srcDir, 'theme-bootstrap.js'), 'assets/theme-bootstrap.js');
  copy(path.join(srcDir, 'diff-config.js'), 'assets/diff-config.js');
  copy(path.join(srcDir, 'diff-app.js'), 'assets/diff-app.js');
  copy(path.join(rootDir, 'assets/branding/favicon-32.png'), 'assets/branding/favicon-32.png');
  copy(path.join(rootDir, 'assets/branding/microsoftx-icon-64.png'), 'assets/branding/microsoftx-icon-64.png');
  copy(path.join(rootDir, 'assets/branding/microsoftx-icon-192.png'), 'assets/branding/microsoftx-icon-192.png');
  copy(path.join(rootDir, 'assets/branding/microsoftx-icon-512.png'), 'assets/branding/microsoftx-icon-512.png');
  copy(path.join(rootDir, 'assets/branding/microsoftx-logo.png'), 'assets/branding/microsoftx-logo.png');
  copy(path.join(rootDir, 'node_modules/marked/lib/marked.umd.js'), 'assets/vendor/marked.js');
  copy(path.join(rootDir, 'node_modules/diff/dist/diff.min.js'), 'assets/vendor/diff.min.js');
  copy(path.join(rootDir, 'node_modules/node-htmldiff/js/htmldiff.js'), 'assets/vendor/htmldiff.js');
  write('assets/vendor/THIRD_PARTY_LICENSES.txt', thirdPartyLicenses());

  write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0067b8"/><path d="M18 14h9l6 11 6-11h9L38 31l11 19h-9L33 37l-7 13h-9l11-19z" fill="white"/></svg>`);
  write('site.webmanifest', `${JSON.stringify({ name: 'MicrosoftX', short_name: 'MicrosoftX', description: 'Client-side page diffs for Microsoft Learn documentation', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#0067b8', icons: [{ src: '/assets/branding/microsoftx-icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/branding/microsoftx-icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2)}\n`);

  const today = new Date().toISOString().slice(0, 10);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${canonicalRoot}/sitemap.xml\n`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/about/', '/supported/', '/privacy/'].map(route => `\n  <url><loc>${canonicalRoot}${route}</loc><lastmod>${today}</lastmod></url>`).join('')}\n</urlset>\n`);
  write('_headers', `/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()

/assets/*
  Cache-Control: public, max-age=3600, must-revalidate
`);
}

if (require.main === module) build();

module.exports = { build, homePage, aboutPage, supportedPage, privacyPage, pageLayout };

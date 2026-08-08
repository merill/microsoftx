#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const config = require('../src/diff-config');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const srcDir = path.join(rootDir, 'src');
const canonicalOrigin = normalizeCanonicalOrigin(process.env.CANONICAL_ORIGIN || 'https://microsoftx.com');
const assetVersion = crypto.createHash('sha256')
  .update([
    __filename,
    path.join(srcDir, 'site.css'),
    path.join(srcDir, 'site.js'),
    path.join(srcDir, 'theme-bootstrap.js'),
    path.join(srcDir, 'diff-config.js'),
    path.join(srcDir, 'diff-app.js'),
    path.join(rootDir, 'assets/branding/docs-xray-dex.png'),
    path.join(rootDir, 'assets/branding/docs-xray-dex-compare.png'),
    path.join(rootDir, 'package-lock.json')
  ].map(file => fs.readFileSync(file)).join('\n'))
  .digest('hex')
  .slice(0, 12);

function versionedAsset(pathName) {
  return `${pathName}?v=${assetVersion}`;
}

function normalizeCanonicalOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('CANONICAL_ORIGIN must be a complete HTTPS origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('CANONICAL_ORIGIN must be an HTTPS origin without a path, query, credentials, or fragment.');
  }
  return url.origin;
}

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
  darkMode: fs.readFileSync(path.join(rootDir, 'assets/icons/nucleo-dark-mode.svg'), 'utf8')
    .replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg class="nucleo-header-icon nucleo-dark-mode-icon" aria-hidden="true" focusable="false"'),
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"></path></svg>',
  settings: fs.readFileSync(path.join(rootDir, 'assets/icons/nucleo-gear-keyhole.svg'), 'utf8')
    .replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg class="nucleo-header-icon nucleo-gear-keyhole-icon" aria-hidden="true" focusable="false"'),
  github: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943"></path></svg>',
  youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"></path></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.555V9H7.12v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z"></path></svg>',
  xSocial: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"></path></svg>',
  tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"></path></svg>',
  bluesky: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358c1.087-2.247 4.046-6.436 6.798-8.501C20.783 1.366 24 .213 24 3.883c0 .732-.42 6.156-.667 7.037-.856 3.061-3.978 3.842-6.755 3.37 4.854.826 6.089 3.562 3.422 6.299-5.065 5.196-7.28-1.304-7.847-2.97-.104-.305-.152-.448-.153-.327 0-.121-.05.022-.153.327-.568 1.666-2.782 8.166-7.847 2.97-2.667-2.737-1.432-5.473 3.422-6.3-2.777.473-5.899-.308-6.755-3.369C.42 10.04 0 4.615 0 3.883c0-3.67 3.217-2.517 5.202-1.026"></path></svg>',
  mastodon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"></path></svg>',
  threads: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z"></path></svg>'
};

const socialProfiles = [
  ['youtube', 'YouTube', 'https://www.youtube.com/@merillx', icons.youtube],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/in/merill', icons.linkedin],
  ['x', 'X', 'https://twitter.com/merill', icons.xSocial],
  ['tiktok', 'TikTok', 'https://www.tiktok.com/@merillf', icons.tiktok],
  ['bluesky', 'Bluesky', 'https://bsky.app/profile/merill.net', icons.bluesky],
  ['mastodon', 'Mastodon', 'https://infosec.exchange/@merill', icons.mastodon],
  ['github', 'GitHub', 'https://github.com/merill', icons.github],
  ['threads', 'Threads', 'https://www.threads.net/@merillf', icons.threads]
];

const msIconsRoot = 'https://raw.githubusercontent.com/DanielBradley1/msicons/3d57443ed4445be9465ee2fee6a6ce6fd02cf90c/msicons/public/icons';
const productDefinitions = [
  ['Microsoft Entra', '/entra', 'entra/Microsoft Entra Product Family.svg'],
  ['Azure', '/azure', 'other/10018-icon-service-Azure-A.svg'],
  ['Microsoft 365', '/microsoft-365', 'Microsoft/dark-blue-Apps.svg'],
  ['Microsoft Intune', '/mem', 'intune/Microsoft-intune.svg'],
  ['Microsoft Graph', '/graph', 'Microsoft/light-blue-Organization Horizontal.svg'],
  ['Microsoft Fabric', '/fabric', 'fabric/fabric_color.svg'],
  ['Dynamics 365', '/dynamics365', 'dynamics-365/Dynamics365_scalable.svg'],
  ['.NET', '/dotnet', 'Microsoft/light-blue-Code.svg'],
  ['ASP.NET Core', '/aspnet/core', 'app-services/10035-icon-service-App-Services.svg'],
  ['PowerShell', '/powershell/scripting', 'general/10825-icon-service-Powershell.svg'],
  ['SQL', '/sql', 'databases/10132-icon-service-SQL-Server.svg'],
  ['Visual Studio', '/visualstudio', 'Microsoft/light-blue-Window Dev Edit.svg'],
  ['Windows Server', '/windows-server', 'general/10835-icon-service-Server-Farm.svg']
];

function supportedProductsComponent({ headingId, className = 'section supported-products-section' }) {
  const configuredLabels = new Set(config.sources.map(source => source.label));
  const products = productDefinitions.filter(([label]) => configuredLabels.has(label));
  const productCards = products.map(([label, learnPath, iconPath]) => {
    const iconUrl = `${msIconsRoot}/${iconPath.split('/').map(encodeURIComponent).join('/')}`;
    return `<a class="product-card" href="https://learn.microsoft.com${learnPath}/" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)} documentation on Microsoft Learn"><span class="product-icon" aria-hidden="true"><img src="${iconUrl}" alt="" width="48" height="48" loading="lazy"></span><span class="product-details"><strong>${escapeHtml(label)}</strong><code>${escapeHtml(learnPath)}</code></span></a>`;
  }).join('');
  return `<section class="${className}" data-supported-products aria-labelledby="${headingId}"><div class="section-heading"><span class="eyebrow">Supported documentation</span><h2 id="${headingId}">Microsoft Learn areas with X-ray vision.</h2><p>${products.length} product areas are mapped to their public documentation source.</p></div><div class="product-grid">${productCards}</div><div class="product-grid-footer"><a href="/supported/">Mapping details and limitations →</a></div></section>`;
}

function navigation(current) {
  const links = [
    ['about', '/about/', 'About']
  ];
  return `<nav class="site-nav" data-site-nav aria-label="Primary navigation">
    ${links.map(([id, href, label]) => `<a href="${href}"${current === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}
    <a href="https://maester.cloud" target="_blank" rel="noopener noreferrer">Maester.Cloud</a>
    <a href="https://entra.news" target="_blank" rel="noopener noreferrer">Entra.News</a>
    <a href="https://merill.net" target="_blank" rel="noopener noreferrer">merill.net</a>
    <a class="github-nav-link" href="https://github.com/merill/microsoftx" target="_blank" rel="noopener noreferrer" aria-label="Microsoft Docs X-Ray on GitHub" title="Microsoft Docs X-Ray on GitHub">${icons.github}</a>
  </nav>`;
}

function header(current) {
  return `<a class="skip-link" href="#main-content">Skip to main content</a>
  <div class="independent-bar">Independent community tool — not affiliated with Microsoft</div>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Microsoft Docs X-Ray home"><img class="brand-logo" src="${versionedAsset('/assets/branding/microsoftx-icon-64.png')}" alt=""><span>Microsoft Docs X-Ray</span><small>See what changed</small></a>
      ${navigation(current)}
      <div class="header-controls">
        <button class="header-action menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-label="Open navigation">${icons.menu}</button>
        <button class="header-action" type="button" data-theme-toggle aria-label="Change color theme" title="Change color theme">${icons.darkMode}</button>
        ${current === 'home' ? `<button class="header-action" type="button" data-github-token-open aria-haspopup="dialog" aria-controls="github-token-drawer" aria-expanded="false" aria-label="Configure GitHub API settings" title="GitHub API settings">${icons.settings}</button>` : ''}
      </div>
    </div>
  </header>`;
}

function footer() {
  return `<footer class="site-footer" id="site-footer">
    <div class="footer-showcase">
      <section class="footer-feature">
        <div class="footer-feature-copy"><span class="footer-eyebrow">Sponsored by</span>
          <a class="footer-feature-heading" href="https://maester.cloud" target="_blank" rel="noopener noreferrer"><img src="https://admin.news/assets/maester.png" width="85" height="85" loading="lazy" alt=""><span>Maester Cloud</span></a>
          <p>Everyone loves using Maester to track their Microsoft Entra and Microsoft 365 tenant security configuration. Maester Cloud turns those daily results into a continuous security record, with 5+ years of history, drift detection, and alerts when your posture changes.</p>
          <a class="footer-cta" href="https://maester.cloud" target="_blank" rel="noopener noreferrer">Explore Maester Cloud <span aria-hidden="true">→</span></a>
        </div>
        <a class="footer-feature-visual" href="https://maester.cloud" target="_blank" rel="noopener noreferrer" aria-label="Explore the Maester Cloud drift dashboard"><img src="/assets/branding/maester-cloud-drift.png" width="2880" height="1728" loading="lazy" alt="Maester Cloud drift dashboard showing security posture changes and an evidence timeline"></a>
      </section>
    </div>
    <div class="footer-utility-wrap">
      <div class="footer-utility">
        <section class="footer-identity"><a class="brand" href="/"><img class="brand-logo" src="${versionedAsset('/assets/branding/microsoftx-icon-64.png')}" alt=""><span>Microsoft Docs X-Ray</span></a><p>Independent community tool for seeing what changed in Microsoft Learn.</p></section>
        <nav class="footer-utility-links" aria-label="Footer"><a href="/about/">About</a><a href="/supported/">Supported documentation</a><a href="/privacy/">Privacy</a><a href="https://github.com/merill/microsoftx" target="_blank" rel="noopener noreferrer">Source on GitHub</a><button class="footer-feedback-button" type="button" data-userjot-feedback>Report an issue or share feedback</button><a href="https://merill.net" target="_blank" rel="noopener noreferrer">merill.net</a><a href="https://daily.entra.news" target="_blank" rel="noopener noreferrer">Daily.Entra.News</a></nav>
        <nav class="social-icon-links" data-social-links aria-label="Follow Merill"><span class="footer-social-title">Follow Merill</span><div class="social-icon-grid">${socialProfiles.map(([id, label, href, icon]) => `<a class="social-${id}" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${icon}</a>`).join('')}</div></nav>
      </div>
      <div class="footer-bottom"><span>© 2026 Merill Fernando.</span><a class="footer-sponsor" href="https://github.com/sponsors/merill" target="_blank" rel="noopener noreferrer"><span aria-hidden="true">♡</span> Buy me a coffee</a><span>Microsoft Learn and Microsoft product names are trademarks of Microsoft Corporation.</span></div>
    </div>
  </footer>`;
}

function githubTokenDrawer() {
  return `<div class="token-drawer-backdrop" data-github-token-backdrop hidden></div>
  <aside class="github-token-drawer" id="github-token-drawer" data-github-token-drawer role="dialog" aria-modal="true" aria-labelledby="github-token-title" hidden>
    <header class="token-drawer-head"><div><span class="eyebrow">Documentation diff</span><h2 id="github-token-title">GitHub API access</h2></div><button class="token-drawer-close" type="button" data-github-token-close aria-label="Close GitHub API settings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>
    <section class="token-form" aria-label="GitHub token settings">
      <div class="token-field-label"><label for="github-api-token">Fine-grained GitHub token</label><span>Optional</span></div>
      <input id="github-api-token" data-github-token-input type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
      <details class="token-drawer-help"><summary><span>How to create the low-privilege token</span><svg class="token-help-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="token-drawer-help-body"><ol><li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">GitHub’s fine-grained token form ↗</a>.</li><li>Choose a short expiration and your personal account as the resource owner.</li><li>Under <strong>Repository access</strong>, select <strong>Public Repositories (read-only)</strong>. Do not select any private repositories.</li><li>Do not grant additional repository or account permissions. Docs X-Ray needs no write permissions.</li><li>Generate the token, then paste and save it here.</li></ol><p class="token-drawer-warning">GitHub associates authenticated requests with your account to apply the higher rate limit. The token is saved only in this browser for the current site domain and sent only to <code>api.github.com</code>.</p></div></details>
      <div class="token-drawer-actions"><button class="button-primary" type="button" data-github-token-save>Save</button><button class="button-secondary" type="button" data-github-token-forget>Remove token</button></div>
      <p class="token-drawer-status" data-github-token-status role="status" aria-live="polite"></p>
    </section>
    <p class="token-drawer-intro">Microsoft Docs X-Ray reads public documentation revisions directly from GitHub. GitHub provides anonymous access to public data, so most people can start without any setup.</p>
    <section class="token-rate-summary" aria-labelledby="github-rate-title"><h3 id="github-rate-title">Why add a token?</h3><p>Anonymous GitHub API requests are shared by everyone using the same public IP address. Each Docs X-Ray comparison uses several requests to find the file history and load revisions.</p><div class="token-rate-grid"><div><strong>60</strong><span>requests per hour</span><small>Anonymous · shared per IP address</small></div><div><strong>5,000</strong><span>requests per hour</span><small>With your optional token</small></div></div><p class="token-rate-note">A home connection will often be fine anonymously. Offices, schools, VPNs, and other shared networks can reach the 60-request allowance sooner. A token gives you GitHub’s much larger authenticated allowance.</p></section>
    <div class="token-limit-alert" data-github-token-alert hidden><strong>GitHub’s API limit was reached</strong><p>The anonymous allowance has been used. Add a token above to continue with your personal GitHub API allowance.</p></div>
    <div class="token-privilege-callout"><span class="token-privilege-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span><div><strong>Public repositories only</strong><p>The token created with the guide above can only read public repositories. It has no access to private repositories and no write permissions, so it cannot change code, issues, pull requests, repository settings, or anything else using your identity.</p></div></div>
  </aside>`;
}

function pageLayout({ title, description, pathName, current, breadcrumbs, content, extraScripts = '', bodyAttributes = '', ogImage = '/assets/branding/microsoftx-og.png', ogImageAlt = 'Microsoft Docs X-Ray — X-ray vision for Microsoft Learn.' }) {
  const canonical = `${canonicalOrigin}${pathName}`;
  const socialImage = `${canonicalOrigin}${ogImage}`;
  return `<!doctype html>
<html lang="en" data-theme="light">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Microsoft Docs X-Ray">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${socialImage}">
  <meta property="og:image:secure_url" content="${socialImage}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${socialImage}">
  <meta name="twitter:image:alt" content="${escapeHtml(ogImageAlt)}">
  <meta name="theme-color" content="#0067b8">
  <link rel="icon" href="${versionedAsset('/assets/branding/favicon-32.png')}" type="image/png" sizes="32x32">
  <link rel="icon" href="${versionedAsset('/assets/branding/microsoftx-icon-64.png')}" type="image/png" sizes="64x64">
  <link rel="apple-touch-icon" href="${versionedAsset('/assets/branding/microsoftx-icon-192.png')}">
  <link rel="manifest" href="/site.webmanifest">
  <link rel="stylesheet" href="${versionedAsset('/assets/site.css')}">
  <script src="${versionedAsset('/assets/theme-bootstrap.js')}"></script>
</head>
<body ${bodyAttributes}>
  <div itemscope itemtype="https://schema.org/WebSite"><meta itemprop="name" content="Microsoft Docs X-Ray"><meta itemprop="url" content="${canonicalOrigin}/"></div>
  ${header(current)}
  ${breadcrumbs || ''}
  ${content}
  ${footer()}
  ${current === 'home' ? githubTokenDrawer() : ''}
  <script src="${versionedAsset('/assets/site.js')}"></script>
  ${extraScripts}
</body>
</html>`;
}

function breadcrumbs(label) {
  return `<nav class="page-shell breadcrumbs" aria-label="Breadcrumb"><a href="/">Docs X-Ray</a><span aria-hidden="true">/</span><span aria-current="page">${escapeHtml(label)}</span></nav>`;
}

function sideNav(current) {
  return `<nav class="side-nav" aria-label="Microsoft Docs X-Ray documentation"><strong>Docs X-Ray</strong><a href="/about/"${current === 'about' ? ' aria-current="page"' : ''}>About</a><a href="/supported/"${current === 'supported' ? ' aria-current="page"' : ''}>Supported docs</a><a href="/privacy/"${current === 'privacy' ? ' aria-current="page"' : ''}>Privacy</a></nav>`;
}

function contentPage({ current, title, lede, sections, aside = '' }) {
  return `<main class="page-shell content-layout" id="main-content">
    ${sideNav(current)}
    <article class="content-main"><span class="eyebrow">Microsoft Docs X-Ray</span><h1>${title}</h1><p class="content-lede">${lede}</p>${sections}</article>
    <aside class="page-toc">${aside}</aside>
  </main>`;
}

function diffApplication() {
  return `<main class="diff-page" data-diff-page hidden>
    <section class="diff-hero" aria-label="Documentation comparison controls">
      <div class="diff-hero-copy"><span class="eyebrow">Microsoft Learn page diff</span><h1>See what changed</h1><p>Inspect the latest edit or compare any two published versions.</p></div>
      <form class="compare-form" data-diff-form>
        <label for="learn-url">Microsoft Learn article URL</label>
        <div class="url-form"><input id="learn-url" name="learn-url" type="url" inputmode="url" autocomplete="url" required placeholder="https://learn.microsoft.com/en-us/entra/…"><button class="button-primary" type="submit">Load diff</button></div>
        <div class="compare-status" data-compare-status role="status" aria-live="polite" hidden></div>
      </form>
    </section>
    <section class="diff-loading" data-diff-loading data-loading-state="mapping" role="status" aria-live="polite" aria-atomic="true" aria-labelledby="diff-loading-title" hidden>
      <div class="diff-loading-panel">
        <div class="diff-loading-art" aria-hidden="true">
          <div class="bot-workbench">
            <span class="bot-document bot-document-before"><i></i><i></i><i></i></span>
            <span class="docs-bot">
              <img class="docs-bot-frame docs-bot-idle" src="${versionedAsset('/assets/branding/docs-xray-dex.png')}" width="640" height="640" alt="">
              <img class="docs-bot-frame docs-bot-compare" src="${versionedAsset('/assets/branding/docs-xray-dex-compare.png')}" width="640" height="640" alt="">
            </span>
            <span class="bot-document bot-document-after"><i></i><i></i><i></i></span>
            <span class="bot-scan"></span>
          </div>
        </div>
        <div class="diff-loading-content">
          <span class="eyebrow">Comparison in progress</span>
          <h2 id="diff-loading-title" data-loading-title>Dex is tracing the source.</h2>
          <p data-loading-message>Matching this Microsoft Learn address to its public documentation repository.</p>
          <div class="diff-loading-progress" data-loading-progress role="progressbar" aria-label="Comparison progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="12" aria-valuetext="Mapping the documentation page"><span></span></div>
          <ol class="diff-loading-steps" aria-label="Comparison steps">
            <li data-loading-phase="mapping"><span></span>Map page</li>
            <li data-loading-phase="history"><span></span>Read history</li>
            <li data-loading-phase="revisions"><span></span>Fetch versions</li>
            <li data-loading-phase="rendering"><span></span>Build diff</li>
          </ol>
          <p class="diff-loading-note">Everything happens in this browser. Larger pages and shared API limits can take a little longer.</p>
        </div>
      </div>
    </section>
    <section class="missing-source-page" data-missing-source-page role="alert" aria-live="assertive" aria-labelledby="missing-source-message" hidden>
      <div class="missing-source-content">
        <h1 id="missing-source-message" data-missing-source-message>We couldn’t find this page’s public GitHub history.</h1>
        <a class="button-primary" href="/supported/">View supported documentation</a>
      </div>
    </section>
    <aside class="diff-intro" data-diff-intro><strong>Supported Microsoft Learn areas</strong><p>Entra, Azure, Microsoft Graph, .NET, PowerShell, Microsoft 365, Intune, Fabric, Dynamics 365, SQL, Visual Studio, ASP.NET Core, and Windows Server.</p><a href="/supported/">View mappings and limitations</a></aside>
    <article data-compare-results hidden>
      <header class="result-head"><span class="eyebrow" data-result-source>Documentation source</span><h2 data-result-title></h2><nav class="source-links" aria-label="Open documentation sources"><a data-result-learn target="_blank" rel="noopener noreferrer" aria-label="Open on Microsoft Learn" title="Open on Microsoft Learn"><img class="microsoft-source-icon" src="${versionedAsset('/assets/icons/microsoft.svg')}" width="16" height="16" alt=""><span>Microsoft Learn</span></a><a data-result-github target="_blank" rel="noopener noreferrer" aria-label="Open the source on GitHub" title="Open the source on GitHub"><img src="${versionedAsset('/assets/icons/github.svg')}" width="16" height="16" alt=""><span>GitHub</span></a></nav></header>
      <div class="diff-workspace"><section class="diff-content" data-diff-content><header class="diff-heading"><div><span class="eyebrow">Browser-generated comparison</span><h2>What changed</h2></div><p data-result-stats></p></header><div class="diff-tabs" role="tablist"><button class="active" type="button" role="tab" aria-selected="true" data-diff-tab="visual">Visual diff</button><button type="button" role="tab" aria-selected="false" data-diff-tab="markdown">Markdown diff</button></div><div class="diff-panel" role="tabpanel" data-diff-panel="visual" data-visual-diff></div><div class="diff-panel" role="tabpanel" data-diff-panel="markdown" data-markdown-diff hidden></div></section><aside class="version-sidebar" aria-label="Version history and comparison controls" data-version-explorer></aside></div>
    </article>
    <nav class="diff-navigator" data-diff-navigator aria-label="Navigate documentation changes" hidden><button type="button" data-diff-previous title="Previous diff" aria-label="Previous diff"><span aria-hidden="true">←</span><span class="diff-navigator-text">Previous diff</span></button><span class="diff-navigator-label" data-diff-position aria-live="polite">Changes</span><button type="button" data-diff-next title="Next diff" aria-label="Next diff"><span class="diff-navigator-text">Next diff</span><span aria-hidden="true">→</span></button></nav>
  </main>`;
}

function unsupportedApplication() {
  return `<main class="unsupported-page" data-unsupported-page hidden>
    <section class="unsupported-message" aria-labelledby="unsupported-heading">
      <h1 id="unsupported-heading">Sorry, this page is not supported by Microsoft Doc X-Ray.</h1>
      <a class="button-primary" href="/" data-unsupported-back>Go back</a>
    </section>
    ${supportedProductsComponent({ headingId: 'unsupported-products-heading', className: 'unsupported-products-section' })}
  </main>`;
}

function homePage() {
  const marketing = `<main data-marketing-root id="main-content" itemscope itemtype="https://schema.org/SoftwareApplication">
    <meta itemprop="name" content="Microsoft Docs X-Ray"><meta itemprop="applicationCategory" content="DeveloperApplication"><meta itemprop="operatingSystem" content="Any modern web browser"><meta itemprop="url" content="${canonicalOrigin}/">
    <section class="home-quick-compare" aria-label="Quick Microsoft Learn page diff"><form data-home-url-form><div class="url-form"><input name="url" type="url" required inputmode="url" autocomplete="url" aria-label="Microsoft Learn article URL" placeholder="Paste a Microsoft Learn URL"><button class="button-primary" type="submit">View diff</button></div><div class="compare-status" data-home-url-status role="status" aria-live="polite" hidden></div></form></section>
    <section class="hero"><div class="hero-inner"><span class="eyebrow">X-ray vision for Microsoft Learn</span><h1>Add an <span class="x-accent">x</span>. See what changed.</h1></div></section>
    <section class="shortcut-demo" aria-labelledby="demo-title"><div class="browser-chrome" aria-hidden="true"><span class="browser-dots"><i></i><i></i><i></i></span><div class="address-bar"><span class="address-prefix">https://learn.microsoft</span><span class="shortcut-x-slot"><mark class="shortcut-x">x</mark><span class="shortcut-pointer"><svg viewBox="0 0 150 62" focusable="false"><path d="M8 52 C50 58 96 48 136 12"></path><path d="M123 12 L137 11 L134 25"></path></svg><strong>Add the x</strong></span></span><span>.com</span><span class="address-trail">/en-us/entra/identity/...</span></div></div><div class="demo-body"><div class="demo-copy"><span class="eyebrow">The one-letter shortcut</span><h2 id="demo-title">One letter reveals the change.</h2><p>While viewing a Microsoft Learn page, add <strong>x</strong> immediately after <strong>microsoft</strong> in the address. Docs X-Ray opens the latest comparison automatically.</p><div class="shortcut-equation"><code>microsoft.com</code><span aria-hidden="true">→</span><code>microsoft<span class="x-accent">x</span>.com</code></div></div><div class="diff-preview" aria-hidden="true"><div class="diff-preview-head"><div><span class="diff-badge">Page Diff</span><span class="diff-badge diff-badge-secondary">Version Diff</span></div><strong>Latest page change</strong></div><div class="diff-preview-file">concept-sms-voice-retirement.md</div><div class="diff-preview-row diff-preview-removed"><span>−</span><code>Previous published guidance</code></div><div class="diff-preview-row diff-preview-added"><span>+</span><code>Updated guidance, revealed</code></div><div class="x-ray-scan"></div></div></div></section>
    ${supportedProductsComponent({ headingId: 'supported-heading' })}
    <section class="section" id="try-it" aria-labelledby="try-heading"><div class="section-heading"><span class="eyebrow">Try it</span><h2 id="try-heading">Open a sample or use your own page.</h2><p>See a real comparison in one click, or paste any supported Microsoft Learn URL. Docs X-Ray opens the diff on whichever site domain you are currently using.</p></div><form data-home-url-form><div class="url-form"><input name="url" type="url" required inputmode="url" autocomplete="url" aria-label="Microsoft Learn article URL" placeholder="https://learn.microsoft.com/en-us/entra/identity/authentication/..."><button class="button-primary" type="submit">View latest diff</button><a class="button-secondary home-sample-button" data-home-sample-link href="/en-us/entra/identity/authentication/concept-sms-voice-retirement">View sample diff</a></div><p class="form-help">Only public, configured Microsoft Learn documentation is supported.</p><div class="compare-status" data-home-url-status role="status" aria-live="polite" hidden></div></form></section>
    <section class="section" itemscope itemtype="https://schema.org/FAQPage"><div class="section-heading"><span class="eyebrow">Frequently asked questions</span><h2>What to know before using Docs X-Ray.</h2></div><div class="faq">
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">Is Microsoft Docs X-Ray an official Microsoft site?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">No. Microsoft Docs X-Ray is an independent community project. It links back to Microsoft Learn and the public GitHub source for every comparison.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">Does it support every Microsoft Learn page?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Not yet. The supported list focuses on product areas with reliable public URL-to-repository mappings. Unsupported pages show a clear explanation instead of guessing.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">I can’t access the microsoftx.com URL. What can I do?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">An alternative URL for this site is <a href="https://mx.merill.net/">https://mx.merill.net/</a>.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">What revisions are compared?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">By default, Docs X-Ray compares the latest two Git commits that affected the mapped Markdown file. Use the timeline to compare any earlier version with today, or open the advanced picker to compare any two versions.</p></div></details>
      <details itemscope itemprop="mainEntity" itemtype="https://schema.org/Question"><summary itemprop="name">Do I need a GitHub token?</summary><div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer"><p itemprop="text">Usually not. GitHub allows up to <strong>60 unauthenticated REST API requests per hour</strong> from an originating IP address. Each Docs X-Ray comparison uses several requests to find the commits and load both revisions, so a shared office, school, or VPN connection can use that allowance sooner than expected.</p><p>Add an optional fine-grained personal access token to raise your authenticated allowance to <strong>5,000 requests per hour</strong>. Public documentation needs no repository permissions. The token stays in this browser and is sent only to <code>api.github.com</code>; Docs X-Ray suggests it only when GitHub reports that the anonymous limit is exhausted. <a href="https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api" target="_blank" rel="noopener noreferrer">Read GitHub’s rate-limit documentation ↗</a></p></div></details>
    </div></section>
  </main>`;
  return pageLayout({
    title: 'Microsoft Docs X-Ray — Add an x. See what changed.',
    description: 'Get X-ray vision for Microsoft Learn. Add one letter to a supported URL to reveal the latest documentation change as a visual and Markdown diff.',
    pathName: '/',
    current: 'home',
    content: `${marketing}${diffApplication()}${unsupportedApplication()}`,
    bodyAttributes: 'class="home-page"',
    extraScripts: `<script src="${versionedAsset('/assets/diff-config.js')}"></script><script src="${versionedAsset('/assets/vendor/marked.js')}"></script><script src="${versionedAsset('/assets/vendor/diff.min.js')}"></script><script src="${versionedAsset('/assets/vendor/htmldiff.js')}"></script><script src="${versionedAsset('/assets/diff-app.js')}"></script>`
  });
}

function aboutPage() {
  const toolGroups = [
    ['Community tools', [
      ['Maester', 'https://maester.dev'],
      ['Maester Cloud', 'https://maester.cloud'],
      ['cmd.ms', 'https://cmd.ms'],
      ['Yako', 'https://getyako.com'],
      ['M365 Message Center & Roadmap Archive', 'https://mc.merill.net'],
      ['Refined Microsoft Learn', 'https://github.com/merill/refined-microsoft-learn'],
      ['bluesky.ms', 'https://bluesky.ms'],
      ['CyberSecPods', 'https://cybersecpods.com']
    ]],
    ['Microsoft Graph and AI tools', [
      ['Microsoft Graph Agent Skill', 'https://skills.sh/merill/msgraph/msgraph'],
      ['M365 Message Center Agent Skill', 'https://skills.sh/merill/mc/microsoft-365-message-center-archive'],
      ['Graph X-Ray', 'https://graphxray.merill.net'],
      ['lokka.dev', 'https://lokka.dev'],
      ['graph.pm', 'https://graph.pm'],
      ['Graph Permissions Explorer', 'https://graphpermissions.merill.net'],
      ['Uninstall-Graph', 'https://uninstall-graph.merill.net'],
      ['VS Code MCP Install Button Generator', 'https://vscodemcp.com']
    ]],
    ['Microsoft Entra and security tools', [
      ['idPowerToys', 'https://idPowerToys.merill.net'],
      ['Entra Sign-in URL Builder', 'https://signin.merill.net'],
      ['Microsoft first-party app names', 'https://aka.ms/AppNames'],
      ['Zero Trust Workshop', 'https://aka.ms/ztworkshop'],
      ['Zero Trust Explorer', 'https://zerotrustexplorer.merill.net'],
      ['Zero Trust Assessment', 'https://github.com/microsoft/zerotrustassessment/'],
      ['Entra Exporter', 'https://github.com/microsoft/EntraExporter'],
      ['MSIdentityTools', 'https://aka.ms/msid']
    ]]
  ];
  const toolDirectory = toolGroups.map(([group, tools]) => `<section class="tool-group" aria-labelledby="${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"><h3 id="${group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${escapeHtml(group)}</h3><div class="tool-link-grid">${tools.map(([name, href]) => `<a href="${href}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(name)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div></section>`).join('');
  const sections = `<h2 id="why">Why it exists</h2><p>Microsoft Learn pages evolve every day. Guidance is clarified, previews become generally available, screenshots change, and recommendations are rewritten. Once a page is updated, the previous wording is easy to miss unless you already know where its source lives and how to read Git history.</p><p>I built Microsoft Docs X-Ray to give everyone X-ray vision into that history. If you can add one letter to a domain, you can look beneath the published page, reveal the latest change, and decide whether it matters to you.</p>
  <h2 id="works">How it works</h2><p>Docs X-Ray translates a supported Learn path into its public GitHub repository and Markdown path. Your browser asks GitHub for the file’s commit timeline, downloads the selected revisions, sanitizes the rendered content, and builds readable visual and raw Markdown diffs.</p><p>There is no Docs X-Ray backend in that flow. The source mapping is checked into the public project, and the comparison happens entirely in your browser.</p>
  <h2 id="community">Made for the community</h2><p>This is an independent project for administrators, architects, developers, writers, and curious people who notice small documentation changes and want to understand why they matter.</p><blockquote><p>Microsoft Docs X-Ray is not a Microsoft product or service. Microsoft Learn remains the canonical documentation source, and every diff links back to the original page and public repository evidence.</p></blockquote><p>If a mapping is missing or wrong, <a href="https://github.com/merill/microsoftx/issues">open an issue on GitHub</a>. Clear examples and community contributions are welcome.</p>
  <h2 id="builder">Built by Merill</h2><div class="author-card"><img class="author-avatar" src="/assets/branding/merill-profile.jpeg" width="112" height="112" loading="lazy" alt="Merill Fernando"><div><h3>Merill Fernando</h3><p>Merill builds community tools and writes about Microsoft Entra and Microsoft 365. Microsoft Docs X-Ray grew from the page-diff explorer in Daily.Entra.News.</p><a href="https://merill.net">Visit merill.net →</a></div></div>
  <h2 id="tools">Explore more tools by Merill</h2><p>Docs X-Ray is one of many free tools, skills, and open-source projects built to make Microsoft cloud administration, security, and development easier. Open any project below to try it.</p><div class="tool-directory" data-merill-tools>${toolDirectory}</div><p class="tools-cta"><a class="button-primary" data-all-tools-cta href="https://merill.net/" target="_blank" rel="noopener noreferrer">Explore every tool on merill.net →</a></p>`;
  return pageLayout({ title: 'About Microsoft Docs X-Ray', description: 'Why Merill Fernando built Microsoft Docs X-Ray and how its browser-only Microsoft Learn page diffs work.', pathName: '/about/', current: 'about', breadcrumbs: breadcrumbs('About'), content: contentPage({ current: 'about', title: 'About Microsoft Docs X-Ray', lede: 'X-ray vision for people who want to know what changed—not only what the documentation says today.', sections, aside: '<strong>In this article</strong><br><a href="#why">Why it exists</a><br><a href="#works">How it works</a><br><a href="#community">Community</a><br><a href="#builder">Built by Merill</a><br><a href="#tools">More tools</a>' }) });
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
    return `<tr id="${anchor}"><th scope="row">${escapeHtml(source.label)}</th><td><a href="${escapeHtml(source.repositoryUrl)}">${escapeHtml(repo)}</a></td><td><code>${escapeHtml(source.defaultBranch)}</code></td><td><a href="/${exampleSuffix}">Try example ↗</a></td></tr>`;
  }).join('');
  const sections = `<h2 id="areas">Supported product areas</h2><p>Microsoft Docs X-Ray uses an ordered, reviewed configuration rather than guessing. Narrow routes such as Microsoft Graph API versions and Fabric get-started pages are matched before broader product routes.</p><div class="table-scroll"><table class="repo-table"><thead><tr><th>Learn area</th><th>Public source repository</th><th>Branch</th><th>Example</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2 id="mapping">How URL mapping works</h2><p>A leading locale such as <code>en-us</code> or <code>fr-fr</code> is removed for repository lookup. The configured Learn prefix is replaced with a repository path prefix, and the article slug becomes a Markdown filename.</p><p>For example, <code>/en-us/entra/identity/conditional-access/overview</code> maps to <code>docs/identity/conditional-access/overview.md</code> in <code>MicrosoftDocs/entra-docs</code>.</p><p>Query-specific mappings are supported. Microsoft Graph’s <code>?view=graph-rest-beta</code> selects the beta API source tree, while <code>graph-rest-1.0</code> selects v1.0.</p>
  <h2 id="limits">Limitations</h2><ul><li>Some Learn pages are generated, private, moved, or sourced through nonstandard publishing pipelines.</li><li>A public URL does not always have a one-to-one public Markdown file.</li><li>Docs X-Ray compares Git revisions, not changes introduced by runtime Learn rendering or personalization.</li><li>Repository moves can temporarily break a mapping until the configuration is updated.</li></ul><p>Unsupported paths fail explicitly and link back to the original Learn page. To request a mapping, <a href="https://github.com/merill/microsoftx/issues">open an issue with an example URL</a>.</p>`;
  return pageLayout({ title: 'Supported Microsoft Learn documentation — Microsoft Docs X-Ray', description: 'Microsoft Learn product areas, public GitHub repositories, branches, examples, and mapping limitations supported by Microsoft Docs X-Ray.', pathName: '/supported/', current: 'supported', breadcrumbs: breadcrumbs('Supported documentation'), content: contentPage({ current: 'supported', title: 'Supported documentation', lede: 'Reliable X-ray vision begins with transparent, testable mappings to public source repositories.', sections, aside: '<strong>In this article</strong><br><a href="#areas">Product areas</a><br><a href="#mapping">URL mapping</a><br><a href="#limits">Limitations</a>' }) });
}

function privacyPage() {
  const sections = `<h2 id="browser">What stays in your browser</h2><p>The page comparison is performed by JavaScript downloaded as part of the static Microsoft Docs X-Ray site. Docs X-Ray has no application server, account system, database, or shared GitHub credential.</p><p>The Microsoft Learn URL you enter is used locally to select a configured public repository and source path.</p>
  <h2 id="github">Requests to GitHub</h2><p>Your browser contacts <code>api.github.com</code> to obtain public commit metadata and Markdown revisions. Relative documentation images can be loaded from <code>raw.githubusercontent.com</code>. GitHub receives the normal network information associated with those requests, including your IP address.</p><p>Docs X-Ray does not proxy these requests or receive their contents.</p>
  <h2 id="token">Optional GitHub token</h2><p>Anonymous access is used first. If GitHub reports that its anonymous API allowance is exhausted, Docs X-Ray can store an optional fine-grained token in this browser’s origin-scoped <code>localStorage</code>. Browsers do not share it with another Docs X-Ray domain.</p><ul><li>The token is added only to HTTPS requests whose hostname is exactly <code>api.github.com</code>.</li><li>It is never added to image requests, analytics, external links, or requests to Docs X-Ray.</li><li>You can remove it at any time from API settings.</li><li>Use the shortest practical expiry and no repository permissions for public documentation.</li></ul>
  <h2 id="feedback">Feedback through UserJot</h2><p>Docs X-Ray loads the UserJot feedback widget from <code>cdn.userjot.com</code> and connects to <code>widget.userjot.com</code>. UserJot receives the normal network information associated with loading and using the widget, including your IP address. Information you submit through the widget is sent to UserJot and handled under <a href="https://userjot.com/privacy" target="_blank" rel="noopener noreferrer">UserJot’s privacy policy</a>.</p><p>The optional GitHub token is never sent to UserJot.</p>
  <h2 id="hosting">Static hosting and logs</h2><p>Cloudflare Pages serves the site’s static files and may process standard web-server information according to Cloudflare’s service operation and your network settings. Docs X-Ray does not add a custom analytics service.</p>
  <h2 id="control">Your controls</h2><p>Clear the optional token through API settings or your browser’s site-data controls. You can also inspect the complete client implementation on <a href="https://github.com/merill/microsoftx">GitHub</a>.</p>`;
  return pageLayout({ title: 'Privacy — Microsoft Docs X-Ray', description: 'How Microsoft Docs X-Ray performs documentation diffs in your browser, contacts GitHub and UserJot, and handles an optional locally stored token.', pathName: '/privacy/', current: 'privacy', breadcrumbs: breadcrumbs('Privacy'), content: contentPage({ current: 'privacy', title: 'Privacy by architecture', lede: 'Microsoft Docs X-Ray is a static site. Article mapping, GitHub requests, and diff generation happen in your browser.', sections, aside: '<strong>In this article</strong><br><a href="#browser">In your browser</a><br><a href="#github">GitHub requests</a><br><a href="#token">Optional token</a><br><a href="#feedback">Feedback widget</a><br><a href="#hosting">Static hosting</a><br><a href="#control">Your controls</a>' }) });
}

function thirdPartyLicenses() {
  const packages = [
    ['marked', 'LICENSE.md'],
    ['diff', 'LICENSE'],
    ['node-htmldiff', 'LICENSE']
  ];
  const packageLicenses = packages.map(([name, license]) => `${name}\n${'='.repeat(name.length)}\n${fs.readFileSync(path.join(rootDir, 'node_modules', name, license), 'utf8').trim()}\n`);
  const iconLicenses = [
    ['GitHub Octicons', 'OCTICONS-LICENSE.txt']
  ].map(([name, license]) => `${name}\n${'='.repeat(name.length)}\n${fs.readFileSync(path.join(rootDir, 'assets', 'icons', license), 'utf8').trim()}\n`);
  return [...packageLicenses, ...iconLicenses].join('\n');
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
  copy(path.join(rootDir, 'assets/branding/microsoftx-og.png'), 'assets/branding/microsoftx-og.png');
  copy(path.join(rootDir, 'assets/branding/docs-xray-dex.png'), 'assets/branding/docs-xray-dex.png');
  copy(path.join(rootDir, 'assets/branding/docs-xray-dex-compare.png'), 'assets/branding/docs-xray-dex-compare.png');
  copy(path.join(rootDir, 'assets/branding/merill-profile.jpeg'), 'assets/branding/merill-profile.jpeg');
  copy(path.join(rootDir, 'assets/branding/maester-cloud-drift.png'), 'assets/branding/maester-cloud-drift.png');
  copy(path.join(rootDir, 'assets/icons/microsoft.svg'), 'assets/icons/microsoft.svg');
  copy(path.join(rootDir, 'assets/icons/github.svg'), 'assets/icons/github.svg');
  copy(path.join(rootDir, 'node_modules/marked/lib/marked.umd.js'), 'assets/vendor/marked.js');
  copy(path.join(rootDir, 'node_modules/diff/dist/diff.min.js'), 'assets/vendor/diff.min.js');
  copy(path.join(rootDir, 'node_modules/node-htmldiff/js/htmldiff.js'), 'assets/vendor/htmldiff.js');
  write('assets/vendor/THIRD_PARTY_LICENSES.txt', thirdPartyLicenses());

  write('site.webmanifest', `${JSON.stringify({ name: 'Microsoft Docs X-Ray', short_name: 'Docs X-Ray', description: 'X-ray vision for Microsoft Learn documentation changes', start_url: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#0067b8', icons: [{ src: '/assets/branding/microsoftx-icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/assets/branding/microsoftx-icon-512.png', sizes: '512x512', type: 'image/png' }] }, null, 2)}\n`);

  const today = new Date().toISOString().slice(0, 10);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${canonicalOrigin}/sitemap.xml\n`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/about/', '/supported/', '/privacy/'].map(route => `\n  <url><loc>${canonicalOrigin}${route}</loc><lastmod>${today}</lastmod></url>`).join('')}\n</urlset>\n`);
  write('_headers', `/*
  Content-Security-Policy: default-src 'self'; script-src 'self' https://cdn.userjot.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.github.com https://widget.userjot.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
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

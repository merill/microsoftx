const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function read(relativePath) {
  return fs.readFileSync(path.join(dist, relativePath), 'utf8');
}

test('build emits static SEO pages and intentionally omits a 404 page', () => {
  for (const file of ['index.html', 'about/index.html', 'supported/index.html', 'privacy/index.html', 'robots.txt', 'sitemap.xml', '_headers', '_routes.json']) {
    assert.equal(fs.existsSync(path.join(dist, file)), true, file);
  }
  assert.equal(fs.existsSync(path.join(dist, '404.html')), false);
});

test('each indexed page has unique metadata, a canonical URL, and one visible document main id', () => {
  const pages = [
    ['index.html', 'https://microsoftx.com/'],
    ['about/index.html', 'https://microsoftx.com/about/'],
    ['supported/index.html', 'https://microsoftx.com/supported/'],
    ['privacy/index.html', 'https://microsoftx.com/privacy/']
  ];
  const titles = new Set();
  for (const [file, canonical] of pages) {
    const dom = new JSDOM(read(file));
    const document = dom.window.document;
    assert.equal(document.querySelector('link[rel="canonical"]').href, canonical);
    assert.ok(document.querySelector('meta[name="description"]').content.length > 40);
    assert.equal(document.querySelector('meta[property="og:image"]').content, 'https://microsoftx.com/assets/branding/microsoftx-og.png');
    assert.equal(document.querySelector('meta[property="og:image:width"]').content, '1200');
    assert.equal(document.querySelector('meta[property="og:image:height"]').content, '630');
    assert.ok(document.querySelector('meta[property="og:image:alt"]').content.length > 20);
    assert.equal(document.querySelector('meta[property="og:site_name"]').content, 'Microsoft Docs X-Ray');
    assert.equal(document.querySelector('meta[name="twitter:card"]').content, 'summary_large_image');
    assert.equal(document.querySelector('meta[name="twitter:image"]').content, 'https://microsoftx.com/assets/branding/microsoftx-og.png');
    assert.match(document.querySelector('link[rel="icon"][sizes="32x32"]').getAttribute('href'), /^\/assets\/branding\/favicon-32\.png\?v=[a-f0-9]{12}$/);
    assert.equal(document.querySelector('link[rel="icon"][type="image/svg+xml"]'), null);
    const authorLink = document.querySelector('.site-nav a[href="https://merill.net"]');
    assert.equal(authorLink.textContent, 'merill.net');
    assert.equal(authorLink.getAttribute('target'), '_blank');
    assert.equal(authorLink.getAttribute('rel'), 'noopener noreferrer');
    const headerLinks = [...document.querySelectorAll('.site-nav > a')];
    assert.deepEqual(headerLinks.slice(0, 4).map(link => link.textContent.trim()), ['About', 'Maester.Cloud', 'Entra.News', 'merill.net']);
    assert.equal(document.querySelector('.site-nav a[href="/"]'), null);
    assert.equal(document.querySelector('.site-nav a[href="/about/"]').textContent, 'About');
    assert.ok(document.querySelector('.footer-utility-links a[href="/supported/"]'));
    assert.ok(document.querySelector('.footer-utility-links a[href="/privacy/"]'));
    assert.equal(document.querySelectorAll('a[href^="https://microsoftx.com"]').length, 0);
    assert.equal(document.querySelectorAll('#main-content').length, 1, file);
    assert.equal(document.querySelector('.independent-bar').textContent.includes('not affiliated with Microsoft'), true);
    assert.match(document.body.textContent, /Microsoft Docs X-Ray|Docs X-Ray/);
    assert.doesNotMatch(document.body.textContent, /MicrosoftX/);
    titles.add(document.title);
  }
  assert.equal(titles.size, pages.length);
});

test('first-party navigation is root-relative while SEO metadata stays on the primary origin', () => {
  for (const file of ['index.html', 'about/index.html', 'supported/index.html', 'privacy/index.html']) {
    const document = new JSDOM(read(file)).window.document;
    assert.equal(document.querySelector('.brand').getAttribute('href'), '/');
    assert.equal(document.querySelectorAll('a[href^="https://microsoftx.com"]').length, 0);
    assert.match(document.querySelector('link[rel="canonical"]').href, /^https:\/\/microsoftx\.com\//);
    assert.match(document.querySelector('meta[property="og:image"]').content, /^https:\/\/microsoftx\.com\//);
  }
  const supported = new JSDOM(read('supported/index.html')).window.document;
  assert.ok(supported.querySelector('.repo-table a[href="/en-us/entra/identity/conditional-access/overview"]'));
  const buildSource = fs.readFileSync(path.join(root, 'scripts/build.js'), 'utf8');
  assert.equal((buildSource.match(/https:\/\/microsoftx\.com/g) || []).length, 1);
  assert.match(buildSource, /process\.env\.CANONICAL_ORIGIN/);
});

test('home page contains crawlable software and FAQ structured data plus the diff shell', () => {
  const html = read('index.html');
  const dom = new JSDOM(html);
  const githubLink = dom.window.document.querySelector('.github-nav-link');
  assert.match(html, /schema\.org\/SoftwareApplication/);
  assert.match(html, /schema\.org\/FAQPage/);
  assert.match(html, /Add an <span class="x-accent">x<\/span>\. See what changed\./);
  assert.doesNotMatch(html, /<h1>[^<]*Add an[\s\S]*?<br>/);
  assert.equal(dom.window.document.querySelector('.hero-inner').children.length, 2);
  assert.match(html, /data-diff-page hidden/);
  assert.match(html, /data-github-token-drawer role="dialog" aria-modal="true"/);
  assert.doesNotMatch(html, /data-rate-actions|<dialog/);
  assert.doesNotMatch(html, /requests remaining|of 60|data-github-rate/i);
  assert.equal(githubLink.getAttribute('aria-label'), 'Microsoft Docs X-Ray on GitHub');
  assert.ok(githubLink.querySelector('svg'));
  assert.match(githubLink.querySelector('path').getAttribute('d'), /^M10\.226 17\.284/);
  assert.equal(githubLink.textContent.trim(), '');
});

test('home page clearly animates the one-letter shortcut without a video runtime', () => {
  const html = read('index.html');
  const css = read('assets/site.css');
  assert.match(html, /One letter reveals the change/);
  assert.match(html, /class="shortcut-x">x<\/mark>/);
  assert.match(html, /<strong>Add the x<\/strong>/);
  assert.match(html, />Page Diff<\/span>/);
  assert.match(html, />Version Diff<\/span>/);
  assert.match(html, /class="x-ray-scan"/);
  assert.doesNotMatch(html, /<video|lottie|remotion/i);
  assert.match(css, /@keyframes shortcut-x-pop/);
  assert.match(css, /@keyframes shortcut-arrow-draw/);
  assert.match(css, /@keyframes shortcut-diff-reveal/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.shortcut-x \{ max-width: 1em; opacity: 1;/);
});

test('home page offers a one-click sample diff on the active site origin', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const sample = document.querySelector('[data-home-sample-link]');
  assert.ok(sample);
  assert.equal(sample.textContent.trim(), 'View Microsoft 365 sample');
  assert.equal(sample.getAttribute('href'), '/en-us/microsoft-365/admin/manage/agent-shadow-ai?_mx_head=11263cbdebfa30cdab477f989fa59f08bffb544a');
  assert.ok(sample.classList.contains('button-secondary'));
  assert.match(sample.closest('form').querySelector('.form-help').textContent, /substantial 49-line Microsoft 365 content revision/);
});

test('home page starts with a compact direct URL shortcut', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const marketing = document.querySelector('[data-marketing-root]');
  const shortcut = marketing.querySelector('.home-quick-compare');
  assert.ok(shortcut);
  assert.equal(shortcut.nextElementSibling.className, 'hero');
  assert.equal(shortcut.querySelector('input').placeholder, 'Paste a supported docs URL');
  assert.equal(shortcut.querySelector('button').textContent, 'View diff');
  assert.equal(marketing.querySelectorAll('[data-home-url-form]').length, 2);
  assert.match(read('assets/diff-app.js'), /querySelectorAll\('\[data-home-url-form\]'\)\.forEach/);
  assert.match(read('assets/site.css'), /\.home-quick-compare form \{[^}]*padding: \.35rem 0;/);
  assert.match(read('assets/site.css'), /\.home-quick-compare \.url-form input \{[^}]*min-height: 36px;/);
  assert.match(read('assets/site.css'), /\.home-quick-compare \{[^}]*position: sticky;[^}]*z-index: 45;[^}]*top: 58px;/);
});

test('GitHub token FAQ explains anonymous and authenticated hourly limits', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const tokenQuestion = [...document.querySelectorAll('.faq details')]
    .find(details => details.querySelector('summary').textContent === 'Do I need a GitHub token?');
  assert.ok(tokenQuestion);
  assert.match(tokenQuestion.textContent, /60 unauthenticated REST API requests per hour/);
  assert.match(tokenQuestion.textContent, /5,000 requests per hour/);
  assert.match(tokenQuestion.textContent, /shared office, school, or VPN connection/);
  assert.equal(tokenQuestion.querySelector('a').href, 'https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api');
});

test('FAQ provides the alternative site URL', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const question = [...document.querySelectorAll('.faq details')]
    .find(details => details.querySelector('summary').textContent.includes('microsoftx.com URL'));
  assert.ok(question);
  const alternative = question.querySelector('a');
  assert.equal(alternative.getAttribute('href'), 'https://mx.merill.net/');
  assert.equal(alternative.textContent, 'https://mx.merill.net/');
});

test('home page replaces How it works with every supported Learn product and path', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const homeProducts = document.querySelector('[data-marketing-root] [data-supported-products]');
  const unsupportedProducts = document.querySelector('[data-unsupported-page] [data-supported-products]');
  const cards = [...homeProducts.querySelectorAll('.product-card')];
  const products = Object.fromEntries(cards.map(card => [
    card.querySelector('strong').textContent,
    card.querySelector('code').textContent
  ]));
  assert.equal(document.querySelector('.feature-grid'), null);
  assert.equal(document.querySelector('.privacy-callout'), null);
  assert.doesNotMatch(document.body.textContent, /How it works/);
  assert.doesNotMatch(document.body.textContent, /Private by architecture/);
  assert.equal(cards.length, 16);
  assert.deepEqual(products, {
    'Microsoft Entra': '/entra',
    'Azure': '/azure',
    'Microsoft 365': '/microsoft-365',
    'Microsoft Defender': '/defender-xdr',
    'Microsoft Intune': '/intune + /mem',
    'Microsoft Graph': '/graph',
    'Microsoft Fabric': '/fabric',
    'Dynamics 365': '/dynamics365',
    'Power Apps': '/power-apps',
    '.NET': '/dotnet',
    'Aspire': 'aspire.dev',
    'ASP.NET Core': '/aspnet/core',
    'PowerShell': '/powershell/scripting',
    'SQL': '/sql',
    'Visual Studio': '/visualstudio',
    'Windows Server': '/windows-server'
  });
  assert.ok(cards.every(card => card.querySelector('img[loading="lazy"][alt=""]')));
  const productIconPaths = {
    'Microsoft Entra': '/assets/icons/products/microsoft-entra.svg',
    'Azure': '/assets/icons/products/azure.svg',
    'Microsoft 365': '/assets/icons/products/microsoft-365.svg',
    'Microsoft Defender': '/assets/icons/microsoft.svg',
    'Microsoft Intune': '/assets/icons/products/microsoft-intune.svg',
    'Microsoft Graph': '/assets/icons/Graph.png',
    'Microsoft Fabric': '/assets/icons/products/microsoft-fabric.svg',
    'Dynamics 365': '/assets/icons/products/dynamics-365.svg',
    'Power Apps': '/assets/icons/products/power-apps.svg',
    '.NET': '/assets/icons/products/dotnet.svg',
    'Aspire': '/assets/icons/products/dotnet.svg',
    'ASP.NET Core': '/assets/icons/products/aspnet.png',
    'PowerShell': '/assets/icons/powershell-1324440216431460950_48px.png',
    'SQL': '/assets/icons/products/sql-server.svg',
    'Visual Studio': '/assets/icons/products/visual-studio.webp',
    'Windows Server': '/assets/icons/products/windows-server.svg'
  };
  for (const card of cards) {
    const label = card.querySelector('strong').textContent;
    const iconPath = productIconPaths[label];
    const iconSource = card.querySelector('img').getAttribute('src');
    assert.equal(iconSource.replace(/\?v=[a-f0-9]{12}$/, ''), iconPath);
    assert.match(iconSource, /\?v=[a-f0-9]{12}$/);
    assert.ok(fs.existsSync(path.join(dist, iconPath.slice(1))), iconPath);
  }
  const aspNetIcon = homeProducts.querySelector('.product-card[href="https://learn.microsoft.com/aspnet/core/"] img');
  assert.ok(aspNetIcon.classList.contains('aspnet-product-icon'));
  assert.ok(homeProducts.querySelector('.product-card[href="https://aspire.dev/"]'));
  assert.match(read('assets/site.css'), /\.product-icon img\.aspnet-product-icon \{[^}]*object-fit: cover;[^}]*transform: scale\(1\.17\);/);
  assert.doesNotMatch(document.body.textContent, /Product icons from MS Icons/);
  assert.equal(document.querySelectorAll('#supported-heading').length, 1);
  assert.deepEqual(
    [...unsupportedProducts.querySelectorAll('.product-card')].map(card => [card.href, card.textContent.trim()]),
    cards.map(card => [card.href, card.textContent.trim()])
  );
});

test('unsupported documentation has a simple reusable product view', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const page = document.querySelector('[data-unsupported-page]');
  assert.ok(page.hidden);
  assert.equal(page.querySelector('h1').textContent, 'Sorry, this page is not supported by Microsoft Doc X-Ray.');
  assert.equal(page.querySelector('.unsupported-message .eyebrow'), null);
  const homeButton = page.querySelector('.unsupported-message a.button-primary');
  assert.equal(homeButton.getAttribute('href'), '/');
  assert.ok(homeButton.hasAttribute('data-unsupported-back'));
  assert.equal(homeButton.textContent, 'Go back');
  assert.equal(page.querySelectorAll('[data-supported-products] .product-card').length, 16);
  assert.equal(page.querySelector('header, footer'), null);
  assert.match(read('assets/site.css'), /\.unsupported-message h1 \{[^}]*font-size: clamp\(2\.5rem, 5\.4vw, 5rem\)/);
});

test('GitHub token settings use the Entra-style slide-over and retry flow', () => {
  const html = read('index.html');
  const siteCss = read('assets/site.css');
  const siteJs = read('assets/site.js');
  const diffJs = read('assets/diff-app.js');
  assert.match(html, /data-github-token-open[^>]*aria-controls="github-token-drawer"[^>]*aria-expanded="false"/);
  assert.match(html, /data-theme-toggle[\s\S]*?<svg class="nucleo-header-icon nucleo-dark-mode-icon" aria-hidden="true" focusable="false" viewBox="0 0 18 18">[\s\S]*?class="nc-icon-wrapper"/);
  assert.match(html, /data-github-token-open[\s\S]*?<svg class="nucleo-header-icon nucleo-gear-keyhole-icon" aria-hidden="true" focusable="false" viewBox="0 0 18 18">[\s\S]*?class="nc-icon-wrapper"/);
  assert.doesNotMatch(html, /data-github-token-open[\s\S]*?<circle cx="12" cy="12" r="3"><\/circle>/);
  assert.match(html, /<div class="header-controls">[\s\S]*data-theme-toggle[\s\S]*data-github-token-open[\s\S]*<\/div>/);
  assert.match(siteCss, /\.header-controls \{[^}]*gap: \.15rem;[^}]*margin-left: -\.85rem;/);
  assert.match(siteCss, /\.header-controls \.header-action \{[^}]*width: 38px;[^}]*padding: \.35rem;/);
  assert.match(html, /class="token-drawer-backdrop" data-github-token-backdrop hidden/);
  assert.match(html, /data-github-token-drawer role="dialog" aria-modal="true"/);
  assert.match(html, /data-github-token-alert hidden/);
  assert.match(html, /personal-access-tokens\/new/);
  assert.match(html, />60<[\s\S]*requests per hour[\s\S]*Anonymous · shared per IP address/);
  assert.match(html, />5,000<[\s\S]*requests per hour[\s\S]*With your optional token/);
  assert.match(html, /Public Repositories \(read-only\)/);
  assert.match(html, /no access to private repositories and no write permissions/);
  assert.match(html, /cannot change code, issues, pull requests, repository settings/);
  assert.match(html, /<details class="token-drawer-help"><summary><span>How to create the low-privilege token<\/span><svg class="token-help-chevron"/);
  assert.doesNotMatch(html, /<details class="token-drawer-help" open/);
  assert.ok(html.indexOf('data-github-token-input') < html.indexOf('token-drawer-help'));
  assert.ok(html.indexOf('token-drawer-help') < html.indexOf('data-github-token-save'));
  assert.ok(html.indexOf('data-github-token-input') < html.indexOf('token-drawer-intro'));
  assert.ok(html.indexOf('data-github-token-save') < html.indexOf('token-rate-summary'));
  assert.match(html, /class="button-primary" type="button" data-github-token-save>Save<\/button>/);
  assert.match(html, /class="button-secondary" type="button" data-github-token-forget>Remove token<\/button>/);
  assert.doesNotMatch(html, />Save token<\/button>/);
  assert.doesNotMatch(siteCss, /\.token-save|\.token-forget/);
  assert.match(html, /Add a token above to continue/);
  assert.doesNotMatch(read('about/index.html'), /data-github-token-drawer|data-github-token-open/);
  assert.match(siteCss, /\.github-token-drawer \{[\s\S]*position: fixed;[\s\S]*right: 0;[\s\S]*height: 100dvh;/);
  assert.match(siteCss, /\.token-help-chevron[\s\S]*transition: transform/);
  assert.doesNotMatch(siteCss, /\.token-privilege-callout \{[^}]*var\(--success\)/);
  assert.match(siteCss, /@keyframes token-drawer-in/);
  assert.match(siteJs, /GITHUB_TOKEN_STORAGE_KEY = 'microsoftx-github-token'/);
  assert.match(siteJs, /github-token-changed/);
  assert.match(siteJs, /github-token-required/);
  assert.match(siteJs, /githubTokenDrawer\.scrollTop = 0/);
  assert.match(siteJs, /data-github-token-close[^\n]*focus\(\{ preventScroll: true \}\)/);
  assert.match(siteJs, /event\.key !== 'Tab'/);
  assert.match(diffJs, /retryAfterTokenChange/);
  assert.match(diffJs, /new root\.CustomEvent\('github-token-required'/);
  assert.match(diffJs, /if \(context\.mode === 'diff'\) addNoIndex\(document\)/);
  assert.doesNotMatch(diffJs, /PRODUCTION_APEX|PRODUCTION_SHORTCUT/);
  assert.doesNotMatch(diffJs, /setupTokenDialog|data-token-open|data-token-dialog/);
});

test('diff navigation remains anchored and centered as the page scrolls', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const siteCss = read('assets/site.css');
  const diffJs = read('assets/diff-app.js');
  assert.ok(document.querySelector('[data-diff-previous]'));
  assert.ok(document.querySelector('[data-diff-next]'));
  assert.equal(document.querySelector('.diff-hero [data-diff-navigator]'), null);
  assert.match(siteCss, /\.diff-navigator \{[\s\S]*position: fixed;[\s\S]*left: 50%;[\s\S]*transform: translateX\(-50%\);/);
  assert.match(siteCss, /\.diff-navigator button \{[\s\S]*height: 40px;/);
  assert.match(siteCss, /\.diff-mode \.site-header \{ position: static; \}/);
  assert.match(diffJs, /function positionNavigator\(\)/);
  assert.match(diffJs, /getBoundingClientRect\(\)\.bottom/);
  assert.match(diffJs, /addEventListener\('scroll', scheduleNavigatorPosition/);
});

test('diff shell includes an accessible animated GitHub loading workspace', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const loading = document.querySelector('[data-diff-loading]');
  assert.ok(loading);
  assert.equal(loading.hidden, true);
  assert.equal(loading.getAttribute('role'), 'status');
  assert.equal(loading.getAttribute('aria-live'), 'polite');
  const mascot = loading.querySelector('.docs-bot');
  assert.ok(mascot);
  const mascotFrames = [...mascot.querySelectorAll('img.docs-bot-frame')];
  assert.equal(mascotFrames.length, 2);
  assert.match(mascotFrames[0].getAttribute('src'), /^\/assets\/branding\/docs-xray-dex\.png\?v=[a-f0-9]{12}$/);
  assert.match(mascotFrames[1].getAttribute('src'), /^\/assets\/branding\/docs-xray-dex-compare\.png\?v=[a-f0-9]{12}$/);
  assert.ok(mascotFrames.every(frame => frame.getAttribute('alt') === ''));
  assert.equal(fs.existsSync(path.join(dist, 'assets/branding/docs-xray-dex.png')), true);
  assert.equal(fs.existsSync(path.join(dist, 'assets/branding/docs-xray-dex-compare.png')), true);
  assert.match(loading.textContent, /Comparison in progress/);
  assert.doesNotMatch(loading.textContent, /GitHub/i);
  assert.doesNotMatch(loading.innerHTML, /bot-head|bot-antenna|bot-arm|bot-base|bot-packet/);
  assert.equal(loading.querySelectorAll('[data-loading-phase]').length, 4);
  const progress = loading.querySelector('[role="progressbar"]');
  assert.equal(progress.getAttribute('aria-valuemin'), '0');
  assert.equal(progress.getAttribute('aria-valuemax'), '100');
  assert.match(read('assets/site.css'), /@keyframes docs-bot-float/);
  assert.match(read('assets/site.css'), /@keyframes dex-compare-pose/);
  assert.match(read('assets/site.css'), /\.diff-loading \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*backdrop-filter: blur\(6px\)/);
  assert.match(read('assets/site.css'), /\.diff-loading-panel \{[\s\S]*width: min\(1040px, calc\(100vw - 2rem\)\);[\s\S]*border-radius: 16px;/);
  assert.match(read('assets/site.css'), /body\.diff-loading-open \{ overflow: hidden; \}/);
  assert.doesNotMatch(read('assets/site.css'), /\.diff-page\.is-loading \.diff-hero/);
  const diffJs = read('assets/diff-app.js');
  const versionSwitchFlow = diffJs.match(/async function compareRefs\(refs\) \{[\s\S]*?results\.addEventListener/)?.[0] || '';
  assert.doesNotMatch(versionSwitchFlow, /results\.hidden = true/);
  assert.match(diffJs, /MINIMUM_LOADING_DURATION = 2000/);
  assert.match(diffJs, /await waitForMinimumLoading\(loadingStartedAt\)/);
});

test('missing mapped source history has a centered supported-docs action', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const page = document.querySelector('[data-missing-source-page]');
  const css = read('assets/site.css');
  assert.ok(page);
  assert.equal(page.hidden, true);
  assert.equal(page.getAttribute('role'), 'alert');
  assert.equal(page.getAttribute('aria-live'), 'assertive');
  assert.equal(page.querySelector('a.button-primary').getAttribute('href'), '/supported/');
  assert.equal(page.querySelector('a.button-primary').textContent, 'View supported documentation');
  assert.match(css, /\.missing-source-page \{[^}]*min-height: calc\(100dvh - 84px\);[^}]*place-items: center;/);
});

test('diff shell provides the timeline, advanced comparison, and share state without commit identities', () => {
  const html = read('index.html');
  const document = new JSDOM(html).window.document;
  const css = read('assets/site.css');
  const js = read('assets/diff-app.js');
  assert.match(html, /data-version-explorer/);
  assert.match(html, /class="diff-workspace"[\s\S]*class="diff-content"[\s\S]*class="version-sidebar"/);
  assert.doesNotMatch(html, /data-result-revisions/);
  assert.doesNotMatch(html, /data-result-history|File history/);
  assert.match(html, /data-result-learn[^>]*aria-label="Open on Microsoft Learn"/);
  assert.match(html, /data-result-github[^>]*aria-label="Open the source on GitHub"/);
  assert.equal(document.querySelector('.mobile-versions-link').getAttribute('href'), '#versions');
  assert.equal(document.querySelector('.mobile-versions-link').textContent.trim(), 'Versions ↓');
  assert.match(html, /class="microsoft-source-icon" src="\/assets\/icons\/microsoft\.svg\?v=[a-f0-9]{12}"/);
  assert.doesNotMatch(html, /data-result-path|class="result-path"/);
  assert.doesNotMatch(js, /querySelector\('\[data-result-path\]'\)/);
  assert.equal((html.match(/class="source-links"/g) || []).length, 1);
  assert.deepEqual(
    [...document.querySelectorAll('.source-links a')].map(link => link.textContent.trim()),
    ['Microsoft Learn', 'GitHub']
  );
  assert.doesNotMatch(html, /Visual blame|data-blame-view|data-diff-tab="blame"/i);
  assert.match(js, /Choose a point in time/);
  assert.match(js, /Advanced: compare any two versions/);
  assert.match(js, /data-share-view aria-label="Copy link to this view" title="Copy link to this view"><svg/);
  assert.doesNotMatch(js, /data-share-view>Copy link to this view/);
  assert.match(css, /\.share-view-button \{[\s\S]*position: absolute;[\s\S]*top: 1rem;[\s\S]*right: 1rem;[\s\S]*width: 36px;[\s\S]*height: 36px;/);
  assert.match(js, /viewUrlForState/);
  assert.match(js, /_mx_view/);
  assert.doesNotMatch(js, /version-meta|commit\.author\?\.login|commit\.commit\?\.author\?\.name|Visual blame/i);
  assert.match(css, /\.version-timeline/);
  assert.match(css, /\.diff-workspace \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) minmax\(330px, 370px\)/);
  assert.match(css, /\.version-sidebar \{ position: sticky;/);
  assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*\.version-sidebar \{ position: static; order: 0;/);
  assert.match(css, /\.mobile-versions-link \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*\.mobile-versions-link \{ display: inline-flex;/);
  assert.doesNotMatch(css, /\.visual-blame|\.blame-row|\.version-meta/);
});

test('About, Supported, and Privacy pages contain the promised durable content', () => {
  const aboutHtml = read('about/index.html');
  const aboutDocument = new JSDOM(aboutHtml).window.document;
  assert.match(aboutHtml, /Why it exists/);
  assert.match(aboutHtml, /Built by Merill/);
  assert.match(aboutHtml, /Explore more tools by Merill/);
  assert.equal(aboutDocument.querySelector('.author-avatar').getAttribute('src'), '/assets/branding/merill-profile.jpeg');
  assert.equal(aboutDocument.querySelector('.author-avatar').getAttribute('alt'), 'Merill Fernando');
  assert.equal(fs.existsSync(path.join(dist, 'assets/branding/merill-profile.jpeg')), true);
  assert.match(read('supported/index.html'), /MicrosoftDocs\/entra-docs/);
  assert.match(read('supported/index.html'), /MicrosoftDocs\/defender-docs/);
  assert.match(read('supported/index.html'), /microsoft\/aspire\.dev/);
  assert.match(read('supported/index.html'), /MicrosoftDocs\/powerapps-docs/);
  assert.ok(new JSDOM(read('supported/index.html')).window.document.querySelector('a[href="/?url=https%3A%2F%2Faspire.dev%2Fget-started%2Fwhat-is-aspire%2F"]'));
  assert.match(read('supported/index.html'), /MicrosoftDocs organization coverage/);
  assert.match(read('supported/index.html'), /graph-rest-beta/);
  assert.match(read('privacy/index.html'), /api\.github\.com/);
  assert.match(read('privacy/index.html'), /source-lookup Function/);
  assert.match(read('privacy/index.html'), /does not receive GitHub history/);
  assert.match(read('privacy/index.html'), /localStorage/);
  assert.match(read('privacy/index.html'), /origin-scoped/);
  assert.match(read('privacy/index.html'), /do not share it with another Docs X-Ray domain/);
});

test('footer links to Merill social profiles', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const links = [...document.querySelectorAll('[data-social-links] a')];
  assert.deepEqual(links.map(link => link.href), [
    'https://www.youtube.com/@merillx',
    'https://linkedin.com/in/merill',
    'https://twitter.com/merill',
    'https://www.tiktok.com/@merillf',
    'https://bsky.app/profile/merill.net',
    'https://infosec.exchange/@merill',
    'https://github.com/merill',
    'https://www.threads.net/@merillf'
  ]);
  assert.ok(links.every(link => link.target === '_blank'));
  assert.ok(links.every(link => link.rel === 'noopener noreferrer'));
  assert.deepEqual(links.map(link => link.getAttribute('aria-label')), ['YouTube', 'LinkedIn', 'X', 'TikTok', 'Bluesky', 'Mastodon', 'GitHub', 'Threads']);
  assert.ok(links.every(link => link.querySelector('svg')));
  assert.ok(links.every(link => link.textContent.trim() === ''));
});

test('footer links to Maester Cloud and GitHub Sponsors', () => {
  const document = new JSDOM(read('index.html')).window.document;
  assert.equal(document.querySelector('.footer-eyebrow').textContent, 'Sponsored by');
  assert.equal(document.querySelector('.footer-feature-heading[href="https://maester.cloud"]').textContent, 'Maester Cloud');
  assert.equal(document.querySelector('.footer-sponsor[href="https://github.com/sponsors/merill"]').textContent.trim(), '♡ Buy me a coffee');
  assert.ok(document.querySelector('.footer-feature-heading img[src="https://admin.news/assets/maester.png"]'));
  const dashboard = document.querySelector('.footer-feature-visual img[src="/assets/branding/maester-cloud-drift.png"]');
  assert.ok(dashboard);
  assert.equal(dashboard.getAttribute('width'), '2880');
  assert.equal(dashboard.getAttribute('height'), '1728');
  const css = read('assets/site.css');
  assert.match(css, /\.footer-feature-visual \{[^}]*aspect-ratio: 5 \/ 3;/);
  assert.match(css, /\.footer-feature-visual img \{[^}]*object-fit: contain;/);
  assert.match(css, /\.footer-feature-heading img \{[^}]*aspect-ratio: 1 \/ 1;/);
  assert.equal(document.querySelector('.footer-support'), null);
  assert.equal(document.querySelector('.footer-community'), null);
  assert.doesNotMatch(document.querySelector('footer').textContent, /More community projects/);
  assert.ok(document.querySelector('.footer-utility'));
});

test('UserJot is initialized for site feedback on every page', () => {
  const siteJs = read('assets/site.js');
  assert.match(siteJs, /USERJOT_PROJECT_ID = 'cmsjwvw5q3wdt0ipd5tpvg5y5'/);
  assert.match(siteJs, /https:\/\/cdn\.userjot\.com\/sdk\/v2\/uj\.js/);
  assert.match(siteJs, /window\.uj\.init\(USERJOT_PROJECT_ID, \{ widget: true, theme: 'auto', position: 'right' \}\)/);
  assert.match(siteJs, /window\.uj\.showWidget\(\{ section: 'feedback' \}\)/);

  for (const file of ['index.html', 'about/index.html', 'supported/index.html', 'privacy/index.html']) {
    const document = new JSDOM(read(file)).window.document;
    const feedback = document.querySelector('button.footer-feedback-button[data-userjot-feedback]');
    assert.ok(feedback, file);
    assert.equal(feedback.textContent.trim(), 'Report an issue or share feedback');
  }

  const dom = new JSDOM(read('index.html'), { url: 'https://microsoftx.test/', runScripts: 'outside-only' });
  dom.window.matchMedia = () => ({ matches: false });
  dom.window.eval(siteJs);
  assert.ok(dom.window.document.querySelector('script[src="https://cdn.userjot.com/sdk/v2/uj.js"]'));
  assert.deepEqual(JSON.parse(JSON.stringify(dom.window.$ujq[0])), [
    'init',
    'cmsjwvw5q3wdt0ipd5tpvg5y5',
    { widget: true, theme: 'auto', position: 'right' }
  ]);
  dom.window.document.querySelector('[data-userjot-feedback]').click();
  assert.deepEqual(JSON.parse(JSON.stringify(dom.window.$ujq.at(-1))), ['showWidget', { section: 'feedback' }]);
});

test('About page links through to Merill tools and projects', () => {
  const document = new JSDOM(read('about/index.html')).window.document;
  const tools = [...document.querySelectorAll('[data-merill-tools] a')];
  assert.equal(tools.length, 24);
  for (const expected of ['Maester', 'Maester Cloud', 'cmd.ms', 'Graph X-Ray', 'idPowerToys', 'Zero Trust Explorer', 'MSIdentityTools']) {
    assert.ok(tools.some(link => link.textContent.includes(expected)), expected);
  }
  assert.ok(tools.every(link => link.target === '_blank'));
  assert.ok(tools.every(link => link.rel === 'noopener noreferrer'));
  assert.equal(document.querySelector('[data-all-tools-cta]').href, 'https://merill.net/');
});

test('sitemap contains only apex static pages and robots points to it', () => {
  const sitemap = read('sitemap.xml');
  for (const route of ['/', '/about/', '/supported/', '/privacy/']) {
    assert.match(sitemap, new RegExp(`<loc>https://microsoftx\\.com${route.replaceAll('/', '\\/')}</loc>`));
  }
  assert.doesNotMatch(sitemap, /learn\.microsoftx\.com/);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/microsoftx\.com\/sitemap\.xml/);
});

test('Pages headers and routes enforce the browser and edge security boundaries', () => {
  const headers = read('_headers');
  assert.match(headers, /connect-src 'self' https:\/\/api\.github\.com https:\/\/widget\.userjot\.com/);
  assert.match(headers, /script-src 'self' https:\/\/cdn\.userjot\.com/);
  assert.match(headers, /style-src 'self' 'unsafe-inline'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  const scriptPolicy = headers.match(/script-src [^;]+/)?.[0] || '';
  assert.doesNotMatch(scriptPolicy, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(headers, /unsafe-eval/);
  assert.deepEqual(JSON.parse(read('_routes.json')), { version: 1, include: ['/api/*'], exclude: [] });
  const sourceFunction = fs.readFileSync(path.join(root, 'functions/api/resolve-source.js'), 'utf8');
  assert.match(sourceFunction, /resolveLearnSource/);
  assert.match(sourceFunction, /AbortSignal\.timeout\(8000\)/);
});

test('all local script, stylesheet, and icon references exist in the build', () => {
  const files = ['index.html', 'about/index.html', 'supported/index.html', 'privacy/index.html'];
  for (const file of files) {
    const dom = new JSDOM(read(file));
    const references = [...dom.window.document.querySelectorAll('script[src],link[href]')]
      .map(node => node.getAttribute('src') || node.getAttribute('href'))
      .filter(value => value.startsWith('/'));
    for (const reference of references) {
      assert.equal(fs.existsSync(path.join(dist, reference.split(/[?#]/)[0])), true, `${file}: ${reference}`);
    }
  }
});

test('first-party CSS and JavaScript references carry one deterministic build version', () => {
  const document = new JSDOM(read('index.html')).window.document;
  const references = [...document.querySelectorAll('script[src^="/assets/"],link[rel="stylesheet"][href^="/assets/"]')]
    .map(node => node.getAttribute('src') || node.getAttribute('href'));
  assert.ok(references.length >= 7);
  const versions = references.map(reference => new URL(reference, 'https://microsoftx.com').searchParams.get('v'));
  assert.ok(versions.every(version => /^[a-f0-9]{12}$/.test(version)));
  assert.equal(new Set(versions).size, 1);
  assert.match(references.find(reference => reference.startsWith('/assets/diff-app.js')), /^\/assets\/diff-app\.js\?v=/);
});

test('social preview uses a deployable 1200 by 630 PNG', () => {
  const image = fs.readFileSync(path.join(dist, 'assets/branding/microsoftx-og.png'));
  const source = fs.readFileSync(path.join(root, 'assets/branding/microsoftx-og.svg'), 'utf8');
  assert.equal(image.subarray(1, 4).toString(), 'PNG');
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
  assert.match(source, />PAGE DIFF<|>Page Diff</);
  assert.match(source, />VERSION DIFF<|>Version Diff</);
  assert.match(source, />ADD THE X</);
  assert.match(source, /stroke-linecap="round"/);
  assert.equal(fs.existsSync(path.join(dist, 'favicon.svg')), false);
});

test('brand and favicon raster assets use transparent, correctly sized PNGs', () => {
  const assets = [
    ['microsoftx-icon-512.png', 512],
    ['microsoftx-icon-192.png', 192],
    ['microsoftx-icon-64.png', 64],
    ['favicon-32.png', 32]
  ];
  for (const [file, size] of assets) {
    const image = fs.readFileSync(path.join(dist, 'assets/branding', file));
    assert.equal(image.subarray(1, 4).toString(), 'PNG', file);
    assert.equal(image.readUInt32BE(16), size, file);
    assert.equal(image.readUInt32BE(20), size, file);
    assert.equal(image[25], 6, `${file} must use RGBA transparency`);
  }
  assert.match(read('assets/site.css'), /\.header-inner > \.brand \.brand-logo \{ width: 40px; height: 40px; \}/);
});

test('the build accepts a validated primary canonical origin', () => {
  try {
    execFileSync(process.execPath, ['scripts/build.js'], {
      cwd: root,
      env: { ...process.env, CANONICAL_ORIGIN: 'https://primary.example' },
      stdio: 'pipe'
    });
    const document = new JSDOM(read('index.html')).window.document;
    assert.equal(document.querySelector('link[rel="canonical"]').href, 'https://primary.example/');
    assert.equal(document.querySelector('meta[property="og:image"]').content, 'https://primary.example/assets/branding/microsoftx-og.png');
    assert.match(read('robots.txt'), /Sitemap: https:\/\/primary\.example\/sitemap\.xml/);

    const invalid = spawnSync(process.execPath, ['scripts/build.js'], {
      cwd: root,
      env: { ...process.env, CANONICAL_ORIGIN: 'http://primary.example/path' },
      encoding: 'utf8'
    });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /CANONICAL_ORIGIN must be an HTTPS origin/);
  } finally {
    execFileSync(process.execPath, ['scripts/build.js'], {
      cwd: root,
      env: { ...process.env, CANONICAL_ORIGIN: 'https://microsoftx.com' },
      stdio: 'pipe'
    });
  }
});

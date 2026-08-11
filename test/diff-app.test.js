const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

global.DOMParser = new JSDOM('<!doctype html>').window.DOMParser;
global.marked = require('marked');
global.Diff = require('diff');
global.htmldiff = require('node-htmldiff');

const config = require('../src/diff-config');
const {
  revisionRefsFromSearchParams,
  viewFromSearchParams,
  resolveShortcutLocation,
  viewUrlForState,
  diffUrlForLearnUrl,
  shortcutUrlForLearnUrl,
  prepareShortcutLanding,
  setLoadingSurface,
  remainingLoadingDuration,
  scrollPageToTop,
  showUnsupportedPage,
  navigateBackOrHome,
  restoreFromUnsupportedHistory,
  showMissingSourcePage,
  isUnsupportedDocumentationError,
  isMissingSourceHistoryError,
  historyExplorer,
  siteUrlToRepoInfo,
  microsoftDocsSourceToRepoInfo,
  resolveSiteUrlToRepoInfo,
  sanitizeRenderedHtml,
  renderVisualDiff,
  renderMarkdownDiff,
  continuousVisualDiffGroups,
  continuousMarkdownDiffGroups,
  request,
  loadHistory,
  validateComparisonRefs,
  loadComparison
} = require('../src/diff-app');

test('shortcut host reconstructs the Learn URL and separates MicrosoftX revisions', () => {
  const result = resolveShortcutLocation('https://learn.microsoftx.com/en-us/graph/api/user-get?view=graph-rest-beta&tabs=http&_mx_base=9152e77&_mx_head=4994b15&_mx_view=markdown#request');
  assert.equal(result.mode, 'diff');
  assert.equal(result.routeStyle, 'path');
  assert.equal(result.targetUrl, 'https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-beta&tabs=http#request');
  assert.deepEqual(result.refs, { base: '9152e77', head: '4994b15' });
  assert.equal(result.view, 'markdown');
});

test('any secure site origin supports portable paths while site routes remain landing pages', () => {
  assert.equal(resolveShortcutLocation('https://learn.microsoftx.com/').mode, 'landing');
  assert.equal(resolveShortcutLocation('https://microsoftx.com/').mode, 'landing');
  assert.equal(resolveShortcutLocation('https://alternative.example/about/').mode, 'landing');
  assert.equal(resolveShortcutLocation('https://alternative.example/about/?url=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Fentra%2Fexample').mode, 'landing');
  const alternative = resolveShortcutLocation('https://alternative.example/en-us/entra/identity/example?tabs=portal#step-1');
  assert.equal(alternative.mode, 'diff');
  assert.equal(alternative.routeStyle, 'path');
  assert.equal(alternative.targetUrl, 'https://learn.microsoft.com/en-us/entra/identity/example?tabs=portal#step-1');
  assert.equal(resolveShortcutLocation('http://alternative.example/en-us/entra/example').mode, 'unsupported-origin');
  assert.equal(
    resolveShortcutLocation('http://127.0.0.1:4173/?url=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Fentra%2Fidentity%2Fexample').targetUrl,
    'https://learn.microsoft.com/en-us/entra/identity/example'
  );
  assert.equal(resolveShortcutLocation('http://learn.localhost:4173/').mode, 'landing');
  assert.equal(
    resolveShortcutLocation('https://alternative.example/?url=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Fazure%2Fexample').routeStyle,
    'query'
  );
});

test('supported documentation URLs convert to same-origin diff routes and reject other sites', () => {
  assert.equal(
    diffUrlForLearnUrl('https://learn.microsoft.com/en-us/entra/identity/example?tabs=portal#step-1', 'https://alternative.example/'),
    'https://alternative.example/en-us/entra/identity/example?tabs=portal#step-1'
  );
  assert.equal(
    shortcutUrlForLearnUrl('https://learn.microsoft.com/en-us/entra/identity/example', 'https://learn.microsoftx.com/'),
    'https://learn.microsoftx.com/en-us/entra/identity/example'
  );
  assert.equal(
    diffUrlForLearnUrl('https://aspire.dev/get-started/what-is-aspire/', 'https://alternative.example/'),
    'https://alternative.example/?url=https%3A%2F%2Faspire.dev%2Fget-started%2Fwhat-is-aspire%2F'
  );
  assert.throws(() => shortcutUrlForLearnUrl('https://example.com/article'), /supported HTTPS documentation/);
  assert.throws(() => shortcutUrlForLearnUrl('http://learn.microsoft.com/article'), /supported HTTPS documentation/);
  assert.throws(() => shortcutUrlForLearnUrl('https://user@aspire.dev/article'), /supported HTTPS documentation/);
  assert.throws(() => siteUrlToRepoInfo('https://aspire.dev:444/article'), /standard HTTPS origin/);
  assert.throws(
    () => diffUrlForLearnUrl('https://learn.microsoft.com/en-us/entra/example', 'http://alternative.example/'),
    /requires HTTPS/
  );
});

test('the bare learn shortcut host puts the diff form directly below the hero', () => {
  const dom = new JSDOM(`<!doctype html><body><main data-marketing-root>
    <section class="hero"></section>
    <section class="shortcut-demo"></section>
    <section id="try-it"><div class="section-heading"><span class="eyebrow">Try it</span><h2>Old heading</h2><p>Old introduction</p></div><form><p class="form-help">Old help</p></form></section>
  </main></body>`);
  const { document } = dom.window;

  assert.equal(prepareShortcutLanding(document, 'https://learn.microsoftx.com/'), true);
  assert.ok(document.body.classList.contains('shortcut-landing'));
  assert.equal(document.querySelector('.hero').nextElementSibling.id, 'try-it');
  assert.equal(document.querySelector('#try-it .eyebrow').textContent, 'Start a page diff');
  assert.match(document.querySelector('#try-it h2').textContent, /Microsoft Learn page/);
  assert.match(document.querySelector('#try-it .form-help').textContent, /learn\.microsoftx\.com\/en-us/);

  const apexDom = new JSDOM('<!doctype html><body><main data-marketing-root><section class="hero"></section><section id="try-it"></section></main></body>');
  assert.equal(prepareShortcutLanding(apexDom.window.document, 'https://microsoftx.com/'), false);
  assert.equal(apexDom.window.document.body.className, '');
});

test('the comparison loader advances through meaningful GitHub phases', () => {
  const dom = new JSDOM(`<!doctype html><main data-diff-page><section data-diff-loading hidden>
    <h2 data-loading-title></h2><p data-loading-message></p>
    <div data-loading-progress role="progressbar"></div>
    <ol><li data-loading-phase="mapping"></li><li data-loading-phase="history"></li><li data-loading-phase="revisions"></li><li data-loading-phase="rendering"></li></ol>
  </section></main>`);
  const page = dom.window.document.querySelector('[data-diff-page]');

  setLoadingSurface(page, 'revisions');
  assert.ok(page.classList.contains('is-loading'));
  assert.ok(dom.window.document.body.classList.contains('diff-loading-open'));
  assert.equal(page.getAttribute('aria-busy'), 'true');
  assert.equal(page.dataset.loadingState, 'revisions');
  assert.equal(page.querySelector('[data-loading-progress]').getAttribute('aria-valuenow'), '72');
  assert.match(page.querySelector('[data-loading-title]').textContent, /versions/);
  assert.equal(page.querySelectorAll('.is-complete').length, 2);
  assert.equal(page.querySelector('.is-active').dataset.loadingPhase, 'revisions');

  setLoadingSurface(page, '', false);
  assert.equal(page.querySelector('[data-diff-loading]').hidden, true);
  assert.ok(!page.classList.contains('is-loading'));
  assert.ok(!dom.window.document.body.classList.contains('diff-loading-open'));
  assert.equal(page.hasAttribute('aria-busy'), false);
});

test('the current version shows its last-changed date in history controls', () => {
  const current = {
    sha: 'a'.repeat(40),
    html_url: 'https://github.com/example/docs/commit/current',
    commit: { author: { date: '2026-08-08T04:30:00Z' }, message: 'Current documentation update' }
  };
  const previous = {
    sha: 'b'.repeat(40),
    html_url: 'https://github.com/example/docs/commit/previous',
    commit: { author: { date: '2026-07-01T03:00:00Z' }, message: 'Previous documentation update' }
  };
  const html = historyExplorer([current, previous], { headCommit: current, baseCommit: previous }, false);
  const document = new JSDOM(html).window.document;
  assert.equal(document.querySelector('.version-explorer').id, 'versions');
  const currentDate = document.querySelector('.version-event.current .version-date').textContent;
  const currentOption = document.querySelector('[data-comparison-head] option').textContent;
  assert.match(currentDate, /^Current version · .*2026/);
  assert.match(currentOption, /^Current version · .*2026.* — Current documentation update$/);
});

test('successful comparisons keep the loading animation visible for at least two seconds', () => {
  assert.equal(remainingLoadingDuration(1000, 1000), 2000);
  assert.equal(remainingLoadingDuration(1000, 1500), 1500);
  assert.equal(remainingLoadingDuration(1000, 2999), 1);
  assert.equal(remainingLoadingDuration(1000, 3000), 0);
  assert.equal(remainingLoadingDuration(1000, 5000), 0);
});

test('completed comparisons reset the page to the top', () => {
  let options;
  scrollPageToTop({ scrollTo: value => { options = value; } });
  assert.deepEqual(options, { top: 0, left: 0, behavior: 'auto' });
  assert.doesNotThrow(() => scrollPageToTop({}));
});

test('unsupported documentation uses a bare page without site chrome', () => {
  const dom = new JSDOM(`<!doctype html><html><head><title>Home</title></head><body class="home-page diff-mode">
    <a class="skip-link">Skip</a><div class="independent-bar">Notice</div><header class="site-header">Header</header>
    <main id="main-content" data-marketing-root></main><main data-diff-page></main>
    <main data-unsupported-page hidden><h1>Unsupported</h1></main><footer class="site-footer">Footer</footer>
  </body></html>`);
  let scrollOptions;
  let pushedState;
  const shown = showUnsupportedPage(dom.window.document, {
    scrollTo: options => { scrollOptions = options; },
    history: { pushState: state => { pushedState = state; } },
    location: { href: 'https://microsoftx.com/' }
  }, true);

  assert.equal(shown, true);
  assert.equal(dom.window.document.querySelector('[data-unsupported-page]').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-unsupported-page]').id, 'main-content');
  assert.equal(dom.window.document.querySelector('[data-marketing-root]').hidden, true);
  assert.equal(dom.window.document.querySelector('[data-diff-page]').hidden, true);
  assert.equal(dom.window.document.querySelector('.skip-link, .independent-bar, .site-header, .site-footer'), null);
  assert.ok(dom.window.document.body.classList.contains('unsupported-mode'));
  assert.ok(!dom.window.document.body.classList.contains('diff-mode'));
  assert.equal(dom.window.document.title, 'Unsupported documentation — Microsoft Docs X-Ray');
  assert.match(dom.window.document.querySelector('meta[name="robots"]').content, /noindex/);
  assert.deepEqual(scrollOptions, { top: 0, left: 0, behavior: 'auto' });
  assert.deepEqual(pushedState, { microsoftXUnsupported: true });
});

test('unsupported navigation returns to browser history with a home fallback', () => {
  let backed = 0;
  assert.equal(navigateBackOrHome({ history: { length: 2, back: () => { backed += 1; } } }), 'back');
  assert.equal(backed, 1);

  let assigned;
  assert.equal(navigateBackOrHome({
    history: { length: 1 },
    location: { href: 'https://microsoftx.com/unsupported', assign: value => { assigned = value; } }
  }), 'home');
  assert.equal(assigned, 'https://microsoftx.com/');
});

test('back navigation reloads an in-place unsupported state', () => {
  const dom = new JSDOM('<!doctype html><body class="unsupported-mode"></body>');
  let reloads = 0;
  assert.equal(restoreFromUnsupportedHistory(dom.window.document, { location: { reload: () => { reloads += 1; } } }), true);
  assert.equal(reloads, 1);
  dom.window.document.body.classList.remove('unsupported-mode');
  assert.equal(restoreFromUnsupportedHistory(dom.window.document, { location: { reload: () => { reloads += 1; } } }), false);
  assert.equal(reloads, 1);
});

test('missing source history is shown as a centered page state', () => {
  const dom = new JSDOM(`<!doctype html><html><head><title>Diff</title></head><body class="diff-mode">
    <header class="site-header">Header</header><main id="main-content" data-diff-page>
      <section class="diff-hero"><div data-compare-status></div></section>
      <section data-diff-loading hidden></section>
      <section data-missing-source-page hidden><h1 data-missing-source-message></h1></section>
      <aside data-diff-intro></aside><article data-compare-results></article><nav data-diff-navigator></nav>
    </main><footer class="site-footer">Footer</footer>
  </body></html>`);
  let scrollOptions;
  const error = new Error('No file history was found at docs/example.md. The Learn page may use a nonstandard source path.');
  const shown = showMissingSourcePage(dom.window.document, error, { scrollTo: options => { scrollOptions = options; } });

  assert.equal(shown, true);
  assert.equal(dom.window.document.querySelector('[data-missing-source-page]').hidden, false);
  assert.equal(dom.window.document.querySelector('[data-missing-source-message]').textContent, error.message);
  assert.equal(dom.window.document.querySelector('.diff-hero').hidden, true);
  assert.equal(dom.window.document.querySelector('[data-diff-intro]').hidden, true);
  assert.equal(dom.window.document.querySelector('[data-compare-results]').hidden, true);
  assert.ok(dom.window.document.body.classList.contains('missing-source-mode'));
  assert.ok(dom.window.document.querySelector('.site-header'));
  assert.ok(dom.window.document.querySelector('.site-footer'));
  assert.equal(dom.window.document.title, 'Page history not found — Microsoft Docs X-Ray');
  assert.deepEqual(scrollOptions, { top: 0, left: 0, behavior: 'auto' });
});

test('revision parameters validate pairs and hexadecimal SHAs', () => {
  assert.deepEqual(revisionRefsFromSearchParams(new URLSearchParams('_mx_head=4994b15')), { base: null, head: '4994b15' });
  assert.throws(() => revisionRefsFromSearchParams(new URLSearchParams('_mx_base=9152e77')), /also requires/);
  assert.throws(() => revisionRefsFromSearchParams(new URLSearchParams('_mx_head=not-a-sha')), /Git commit SHAs/);
  assert.throws(() => revisionRefsFromSearchParams(new URLSearchParams('_mx_base=4994b15&_mx_head=4994b15')), /must be different/);
});

test('view state URLs preserve exact revisions, the selected tab, and local target URLs', () => {
  assert.equal(viewFromSearchParams(new URLSearchParams('_mx_view=markdown')), 'markdown');
  assert.equal(viewFromSearchParams(new URLSearchParams('_mx_view=unknown')), 'visual');
  const local = new URL(viewUrlForState(
    'http://127.0.0.1:4173/?url=https%3A%2F%2Flearn.microsoft.com%2Fold',
    'https://learn.microsoft.com/en-us/entra/identity/example?tabs=portal',
    { base: 'a'.repeat(40), head: 'b'.repeat(40) },
    'markdown'
  ));
  assert.equal(local.searchParams.get('url'), 'https://learn.microsoft.com/en-us/entra/identity/example?tabs=portal');
  assert.equal(local.searchParams.get('_mx_base'), 'a'.repeat(40));
  assert.equal(local.searchParams.get('_mx_head'), 'b'.repeat(40));
  assert.equal(local.searchParams.get('_mx_view'), 'markdown');

  const portable = new URL(viewUrlForState(
    'https://alternative.example/en-us/entra/identity/example?tabs=portal#step-1',
    'https://learn.microsoft.com/en-us/entra/identity/example?tabs=portal#step-1',
    { base: 'c'.repeat(40), head: 'd'.repeat(40) },
    'markdown'
  ));
  assert.equal(portable.origin, 'https://alternative.example');
  assert.equal(portable.pathname, '/en-us/entra/identity/example');
  assert.equal(portable.searchParams.get('url'), null);
  assert.equal(portable.searchParams.get('tabs'), 'portal');
  assert.equal(portable.searchParams.get('_mx_base'), 'c'.repeat(40));
  assert.equal(portable.searchParams.get('_mx_head'), 'd'.repeat(40));
  assert.equal(portable.hash, '#step-1');

  const learnUrlQuery = new URL(viewUrlForState(
    'https://alternative.example/en-us/entra/identity/example?url=embedded-help',
    'https://learn.microsoft.com/en-us/entra/identity/example?url=embedded-help',
    { head: 'e'.repeat(40) }
  ));
  assert.equal(learnUrlQuery.searchParams.get('url'), 'embedded-help');
});

test('the supplied Entra article maps to the expected public repository path', () => {
  const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/authentication/concept-sms-voice-retirement');
  assert.equal(info.repository, 'MicrosoftDocs/entra-docs');
  assert.equal(info.path, 'docs/identity/authentication/concept-sms-voice-retirement.md');
  assert.equal(info.defaultBranch, 'main');
});

test('current and legacy Intune routes map to the same memdocs source file', () => {
  const article = 'fundamentals/role-based-access-control/multi-admin-approval';
  const current = siteUrlToRepoInfo(`https://learn.microsoft.com/en-us/intune/${article}`);
  const legacy = siteUrlToRepoInfo(`https://learn.microsoft.com/en-us/mem/intune/${article}`);
  assert.deepEqual(
    [current.repository, current.path, current.defaultBranch],
    ['MicrosoftDocs/memdocs', `intune/${article}.md`, 'main']
  );
  assert.deepEqual(
    [legacy.repository, legacy.path, legacy.defaultBranch],
    [current.repository, current.path, current.defaultBranch]
  );
});

test('representative configured docsets map to their public repositories', () => {
  const examples = [
    ['https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview', 'MicrosoftDocs/entra-docs', 'docs/identity/conditional-access/overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/azure/virtual-machines/linux/quick-create-cli', 'MicrosoftDocs/azure-compute-docs', 'articles/virtual-machines/linux/quick-create-cli.md', 'main'],
    ['https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview', 'MicrosoftDocs/azure-docs', 'articles/azure-functions/functions-overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/dotnet/core/introduction', 'dotnet/docs', 'docs/core/introduction.md', 'main'],
    ['https://aspire.dev/get-started/what-is-aspire/', 'microsoft/aspire.dev', 'src/frontend/src/content/docs/get-started/what-is-aspire.mdx', 'main'],
    ['https://learn.microsoft.com/en-us/powershell/scripting/overview', 'MicrosoftDocs/PowerShell-Docs', 'reference/docs-conceptual/overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/microsoft-365/admin/setup/setup', 'MicrosoftDocs/microsoft-365-docs', 'microsoft-365/admin/setup/setup.md', 'public'],
    ['https://learn.microsoft.com/en-us/mem/intune/fundamentals/what-is-intune', 'MicrosoftDocs/memdocs', 'intune/fundamentals/what-is-intune.md', 'main'],
    ['https://learn.microsoft.com/en-us/fabric/get-started/microsoft-fabric-overview', 'MicrosoftDocs/fabric-docs', 'docs/fundamentals/microsoft-fabric-overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/dynamics365/get-started/intro-crossapp-index', 'MicrosoftDocs/dynamics365hubpages', 'dynamics365/get-started/intro-crossapp-index.md', 'live'],
    ['https://learn.microsoft.com/en-us/power-apps/powerapps-overview', 'MicrosoftDocs/powerapps-docs', 'powerapps-docs/powerapps-overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/sql/sql-server/what-s-new-in-sql-server-2025', 'MicrosoftDocs/sql-docs', 'docs/sql-server/what-s-new-in-sql-server-2025.md', 'live'],
    ['https://learn.microsoft.com/en-us/graph/overview', 'microsoftgraph/microsoft-graph-docs-contrib', 'concepts/overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/visualstudio/ide/whats-new-visual-studio-2022', 'MicrosoftDocs/visualstudio-docs', 'docs/ide/whats-new-visual-studio-2022.md', 'main'],
    ['https://learn.microsoft.com/en-us/aspnet/core/introduction-to-aspnet-core', 'dotnet/AspNetCore.Docs', 'aspnetcore/overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/windows-server/get-started/overview', 'MicrosoftDocs/windowsserverdocs', 'WindowsServerDocs/get-started/overview.md', 'main']
  ];
  for (const [url, repository, path, branch] of examples) {
    const info = siteUrlToRepoInfo(url, config.sources);
    assert.equal(info.repository, repository, url);
    assert.equal(info.path, path, url);
    assert.equal(info.defaultBranch, branch, url);
  }
});

test('legacy Aspire Learn URLs map to the current Aspire MDX source', () => {
  const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/dotnet/aspire/get-started/aspire-overview');
  assert.equal(info.repository, 'microsoft/aspire.dev');
  assert.equal(info.path, 'src/frontend/src/content/docs/get-started/what-is-aspire.mdx');
  assert.equal(info.defaultBranch, 'main');
  assert.equal(info.siteLabel, 'Aspire');
});

test('Defender Learn areas map to the defender-docs public branch and exact source folders', () => {
  const examples = [
    ['https://learn.microsoft.com/en-us/defender-for-identity/what-is', 'defender-for-identity/what-is.md'],
    ['https://learn.microsoft.com/en-us/azure/defender-for-iot/organizations/overview', 'defender-for-iot-azure/organizations/overview.md'],
    ['https://learn.microsoft.com/en-us/azure/defender-for-cloud/defender-for-cloud-introduction', 'defender-for-cloud/defender-for-cloud-introduction.md'],
    ['https://learn.microsoft.com/en-us/azure/external-attack-surface-management/overview', 'easm/overview.md'],
    ['https://learn.microsoft.com/en-us/azure/sentinel/overview', 'sentinel/overview.md'],
    ['https://learn.microsoft.com/en-us/defender-business/mdb-overview', 'defender-business/mdb-overview.md'],
    ['https://learn.microsoft.com/en-us/defender-cloud-apps/what-is-defender-for-cloud-apps', 'defender-for-cloud-apps/what-is-defender-for-cloud-apps.md'],
    ['https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-endpoint', 'defender-endpoint/microsoft-defender-endpoint.md'],
    ['https://learn.microsoft.com/en-us/defender-for-iot/get-started', 'defender-for-iot/get-started.md'],
    ['https://learn.microsoft.com/en-us/defender-office-365/mdo-about', 'defender-office-365/mdo-about.md'],
    ['https://learn.microsoft.com/en-us/defender-vulnerability-management/defender-vulnerability-management', 'defender-vulnerability-management/defender-vulnerability-management.md'],
    ['https://learn.microsoft.com/en-us/defender-xdr/microsoft-365-defender', 'defender-xdr/microsoft-365-defender.md'],
    ['https://learn.microsoft.com/en-us/security-exposure-management/microsoft-security-exposure-management', 'exposure-management/microsoft-security-exposure-management.md'],
    ['https://learn.microsoft.com/en-us/unified-secops/overview-unified-security', 'unified-secops-platform/overview-unified-security.md']
  ];
  for (const [url, path] of examples) {
    const info = siteUrlToRepoInfo(url, config.sources);
    assert.equal(info.repository, 'MicrosoftDocs/defender-docs', url);
    assert.equal(info.defaultBranch, 'public', url);
    assert.equal(info.path, path, url);
  }
});

test('unconfigured MicrosoftDocs pages resolve from validated Learn source metadata', async () => {
  let requested;
  const fetcher = async endpoint => {
    requested = new URL(String(endpoint));
    return new Response(JSON.stringify({
      sourceUrl: 'https://github.com/MicrosoftDocs/terminal/blob/main/terminal/get-started.md'
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const learnUrl = 'https://learn.microsoft.com/en-us/windows/terminal/get-started';
  const info = await resolveSiteUrlToRepoInfo(learnUrl, config.sources, fetcher);
  assert.equal(requested.pathname, '/api/resolve-source');
  assert.equal(requested.searchParams.get('url'), learnUrl);
  assert.equal(info.repository, 'MicrosoftDocs/terminal');
  assert.equal(info.defaultBranch, 'main');
  assert.equal(info.path, 'terminal/get-started.md');
  assert.equal(info.sourceResolution, 'resolved');
});

test('source verification can override broad configured routes while a lookup outage falls back safely', async () => {
  const learnUrl = 'https://learn.microsoft.com/en-us/azure/ai-services/what-are-ai-services';
  const resolved = await resolveSiteUrlToRepoInfo(learnUrl, config.sources, async () => new Response(JSON.stringify({
    sourceUrl: 'https://github.com/MicrosoftDocs/azure-ai-docs/blob/main/articles/ai-services/what-are-ai-services.md'
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  assert.equal(resolved.repository, 'MicrosoftDocs/azure-ai-docs');
  assert.equal(resolved.path, 'articles/ai-services/what-are-ai-services.md');

  const fallback = await resolveSiteUrlToRepoInfo(learnUrl, config.sources, async () => new Response(JSON.stringify({
    error: 'Temporary lookup failure.'
  }), { status: 503, headers: { 'content-type': 'application/json' } }));
  assert.equal(fallback.repository, 'MicrosoftDocs/azure-docs');
  assert.equal(fallback.sourceResolution, 'verify');
});

test('resolved source metadata rejects repositories outside MicrosoftDocs and unsafe paths', () => {
  assert.throws(
    () => microsoftDocsSourceToRepoInfo(
      'https://learn.microsoft.com/en-us/windows/terminal/get-started',
      'https://github.com/example/docs/blob/main/get-started.md'
    ),
    /MicrosoftDocs organization/
  );
  assert.throws(
    () => microsoftDocsSourceToRepoInfo(
      'https://learn.microsoft.com/en-us/windows/terminal/get-started',
      'https://github.com/MicrosoftDocs/terminal/blob/main/bad%2Fpath.md'
    ),
    /unsafe path segment/
  );
});

test('query-specific Graph mappings distinguish beta and v1', () => {
  assert.equal(
    siteUrlToRepoInfo('https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-beta&tabs=http').path,
    'api-reference/beta/api/user-get.md'
  );
  assert.equal(
    siteUrlToRepoInfo('https://learn.microsoft.com/en-us/graph/api/user-get?view=graph-rest-1.0').path,
    'api-reference/v1.0/api/user-get.md'
  );
});

test('unsupported hosts and encoded path separators are rejected', () => {
  assert.throws(
    () => siteUrlToRepoInfo('https://example.com/en-us/entra/identity/example'),
    error => isUnsupportedDocumentationError(error) && /not supported/.test(error.message)
  );
  assert.throws(() => siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/bad%2Fsegment'), /unsafe path segment/);
});

test('rendered Markdown HTML is sanitized and safe links are rewritten', () => {
  const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/example');
  const output = sanitizeRenderedHtml(
    '<script>alert(1)</script><p onclick="alert(1)"><a href="javascript:alert(1)" style="color:red">bad</a><a href="https://example.com/docs">good</a><img src="media/image.png" onerror="alert(1)"><iframe src="https://example.com"></iframe></p>',
    info,
    'a'.repeat(40)
  );
  assert.doesNotMatch(output, /script|iframe|onclick|onerror|javascript:|style=/i);
  assert.match(output, /href="https:\/\/example\.com\/docs"/);
  assert.match(output, /src="https:\/\/raw\.githubusercontent\.com\/MicrosoftDocs\/entra-docs\/a{40}\/docs\/identity\/media\/image\.png"/);
  assert.match(output, /rel="noopener noreferrer"/);
});

test('visual rendering removes front matter and produces insert/delete markup', () => {
  const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/example');
  const output = renderVisualDiff(
    '---\ntitle: Example\n---\n# Heading\nOld text\n',
    '---\ntitle: Example\n---\n# Heading\nNew text\n',
    info,
    'a'.repeat(40),
    'b'.repeat(40)
  );
  assert.doesNotMatch(output, /title: Example/);
  assert.match(output, /<ins|<del/);
});

test('continuous changed content is grouped into a single navigation stop', () => {
  const document = new JSDOM(`<div data-diff-panel="visual">
    <div class="rich-diff">
      <h1><ins>Added heading</ins></h1>
      <p><ins>Added introduction</ins></p>
      <p>Unchanged context</p>
      <p><del>Old ending</del><ins>New ending</ins></p>
    </div>
  </div>`).window.document;
  const groups = continuousVisualDiffGroups(document.querySelector('[data-diff-panel]'));
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map(group => group.length), [2, 1]);

  document.querySelector('.rich-diff p:nth-of-type(2)').innerHTML = '<ins>Added context</ins>';
  const continuous = continuousVisualDiffGroups(document.querySelector('[data-diff-panel]'));
  assert.equal(continuous.length, 1);
  assert.equal(continuous[0].length, 4);
});

test('Markdown navigation treats each continuous hunk as one change', () => {
  const document = new JSDOM(`<div data-diff-panel="markdown">
    <span class="markdown-diff-line hunk">@@ -1 +1 @@</span>
    <span class="markdown-diff-line removed">-old</span>
    <span class="markdown-diff-line added">+new</span>
    <span class="markdown-diff-line hunk">@@ -10 +10 @@</span>
    <span class="markdown-diff-line added">+another</span>
  </div>`).window.document;
  assert.equal(continuousMarkdownDiffGroups(document.querySelector('[data-diff-panel]')).length, 2);
});

test('new files are identified inside both visual and Markdown diffs', () => {
  const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/example');
  const after = '# Brand new page\n\nThis content was just added.\n';
  const visual = renderVisualDiff('', after, info, '', 'b'.repeat(40));
  const markdown = renderMarkdownDiff('', after, info, '', 'b'.repeat(40));
  for (const output of [visual, markdown]) {
    assert.match(output, /New page/);
    assert.match(output, /did not exist before this revision/);
  }
  assert.match(markdown, /new file/);
});

test('comparison picker requires chronological, distinct versions', () => {
  const history = ['c', 'b', 'a'].map(sha => ({ sha: sha.repeat(40) }));
  assert.deepEqual(validateComparisonRefs(history, 'a'.repeat(40), 'c'.repeat(40)), {
    base: 'a'.repeat(40), head: 'c'.repeat(40)
  });
  assert.throws(() => validateComparisonRefs(history, 'c'.repeat(40), 'a'.repeat(40)), /earlier version/);
  assert.throws(() => validateComparisonRefs(history, 'b'.repeat(40), 'b'.repeat(40)), /different versions/);
});

test('API requests block non-GitHub origins and attach tokens only to api.github.com', async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (endpoint, options) => {
    captured = { endpoint, options };
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await request('https://api.github.com/repos/example/docs', 'secret-token');
    assert.equal(new URL(captured.endpoint).hostname, 'api.github.com');
    assert.equal(captured.options.headers.Authorization, 'Bearer secret-token');
    await assert.rejects(() => request('https://evil.example/collect', 'secret-token'), /outside api\.github\.com/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('latest comparison loads commit history and both raw revisions', async () => {
  const originalFetch = global.fetch;
  const head = 'b'.repeat(40);
  const base = 'a'.repeat(40);
  global.fetch = async endpoint => {
    const url = String(endpoint);
    if (url.includes('/commits?path=')) return new Response(JSON.stringify([{ sha: head }, { sha: base }]), { status: 200 });
    if (url.endsWith(`?ref=${head}`)) return new Response('# After\n', { status: 200 });
    if (url.endsWith(`?ref=${base}`)) return new Response('# Before\n', { status: 200 });
    return new Response(JSON.stringify({ message: 'Unexpected request' }), { status: 500 });
  };
  try {
    const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/example');
    const result = await loadComparison(info, '', null);
    assert.equal(result.headCommit.sha, head);
    assert.equal(result.baseCommit.sha, base);
    assert.equal(result.before, '# Before\n');
    assert.equal(result.after, '# After\n');
  } finally {
    global.fetch = originalFetch;
  }
});

test('an empty mapped file history is classified as a missing source path', async () => {
  const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/example');
  await assert.rejects(
    () => loadComparison(info, '', null, []),
    error => isMissingSourceHistoryError(error) && error.message.includes(info.path)
  );
});

test('history loading requests a branch-scoped, paginated file timeline', async () => {
  const originalFetch = global.fetch;
  let requested;
  global.fetch = async endpoint => {
    requested = new URL(String(endpoint));
    return new Response(JSON.stringify([]), { status: 200 });
  };
  try {
    const info = siteUrlToRepoInfo('https://learn.microsoft.com/en-us/entra/identity/example');
    await loadHistory(info, '', 2, 100, 'feature/test');
    assert.equal(requested.pathname.endsWith('/commits'), true);
    assert.equal(requested.searchParams.get('path'), info.path);
    assert.equal(requested.searchParams.get('sha'), 'feature/test');
    assert.equal(requested.searchParams.get('per_page'), '100');
    assert.equal(requested.searchParams.get('page'), '2');
  } finally {
    global.fetch = originalFetch;
  }
});

test('rate-limit errors appear only when GitHub reports exhaustion', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ message: 'API rate limit exceeded' }), {
    status: 403,
    headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1785909600' }
  });
  try {
    await assert.rejects(
      () => request('https://api.github.com/repos/example/docs', ''),
      error => error.rateLimited === true && /anonymous API limit/.test(error.message)
    );
  } finally {
    global.fetch = originalFetch;
  }
});

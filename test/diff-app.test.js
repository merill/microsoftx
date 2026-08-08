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
  siteUrlToRepoInfo,
  sanitizeRenderedHtml,
  renderVisualDiff,
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
  assert.equal(
    resolveShortcutLocation('https://alternative.example/?url=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Fazure%2Fexample').routeStyle,
    'query'
  );
});

test('Learn URLs convert to same-origin portable diff paths and reject other sites', () => {
  assert.equal(
    diffUrlForLearnUrl('https://learn.microsoft.com/en-us/entra/identity/example?tabs=portal#step-1', 'https://alternative.example/'),
    'https://alternative.example/en-us/entra/identity/example?tabs=portal#step-1'
  );
  assert.equal(
    shortcutUrlForLearnUrl('https://learn.microsoft.com/en-us/entra/identity/example', 'https://learn.microsoftx.com/'),
    'https://learn.microsoftx.com/en-us/entra/identity/example'
  );
  assert.throws(() => shortcutUrlForLearnUrl('https://example.com/article'), /learn\.microsoft\.com/);
  assert.throws(() => shortcutUrlForLearnUrl('http://learn.microsoft.com/article'), /https:\/\/learn\.microsoft\.com/);
  assert.throws(
    () => diffUrlForLearnUrl('https://learn.microsoft.com/en-us/entra/example', 'http://alternative.example/'),
    /requires HTTPS/
  );
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

test('representative configured docsets map to their public repositories', () => {
  const examples = [
    ['https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview', 'MicrosoftDocs/entra-docs', 'docs/identity/conditional-access/overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/azure/azure-functions/functions-overview', 'MicrosoftDocs/azure-docs', 'articles/azure-functions/functions-overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/dotnet/core/introduction', 'dotnet/docs', 'docs/core/introduction.md', 'main'],
    ['https://learn.microsoft.com/en-us/powershell/scripting/overview', 'MicrosoftDocs/PowerShell-Docs', 'reference/docs-conceptual/overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/microsoft-365/admin/setup/setup', 'MicrosoftDocs/microsoft-365-docs', 'microsoft-365/admin/setup/setup.md', 'public'],
    ['https://learn.microsoft.com/en-us/mem/intune/fundamentals/what-is-intune', 'MicrosoftDocs/memdocs', 'intune/fundamentals/what-is-intune.md', 'main'],
    ['https://learn.microsoft.com/en-us/fabric/get-started/microsoft-fabric-overview', 'MicrosoftDocs/fabric-docs', 'docs/fundamentals/microsoft-fabric-overview.md', 'main'],
    ['https://learn.microsoft.com/en-us/dynamics365/get-started/intro-crossapp-index', 'MicrosoftDocs/dynamics365hubpages', 'dynamics365/get-started/intro-crossapp-index.md', 'live'],
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
  assert.throws(() => siteUrlToRepoInfo('https://example.com/en-us/entra/identity/example'), /not supported/);
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

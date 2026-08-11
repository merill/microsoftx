(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MicrosoftXDiff = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const TOKEN_STORAGE_KEY = 'microsoftx-github-token';
  const HISTORY_PAGE_SIZE = 100;
  const MINIMUM_LOADING_DURATION = 2000;
  const VIEW_NAMES = new Set(['visual', 'markdown']);
  const LOADING_PHASES = Object.freeze({
    mapping: { progress: 12, title: 'Dex is tracing the source.', message: 'Matching this documentation address to its public source repository.', aria: 'Mapping the documentation page' },
    history: { progress: 38, title: 'Dex is reading the page history.', message: 'Finding the revisions that changed this documentation page.', aria: 'Reading the documentation history' },
    revisions: { progress: 72, title: 'Dex is fetching both versions.', message: 'Loading the before and after versions of the page.', aria: 'Fetching both documentation versions' },
    rendering: { progress: 94, title: 'Dex is building your X-ray view.', message: 'Sanitizing the Markdown and calculating the visual and source diffs in this browser.', aria: 'Rendering the page comparison' }
  });
  const ROOT_PATHS = new Set(['/', '/index.html']);
  const LANDING_PATHS = new Set(['/', '/index.html', '/about', '/about/', '/supported', '/supported/', '/privacy', '/privacy/']);
  let nodeConfig = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    try { nodeConfig = require('./diff-config'); } catch {}
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[character]));
  }

  function configuredSources() {
    const supplied = root.MICROSOFTX_DIFF_CONFIG?.sources || nodeConfig?.sources;
    return Array.isArray(supplied) ? supplied : [];
  }

  function unsupportedDocumentationError(message) {
    const error = new Error(message);
    error.code = 'UNSUPPORTED_DOCUMENTATION';
    return error;
  }

  function isUnsupportedDocumentationError(error) {
    return error?.code === 'UNSUPPORTED_DOCUMENTATION';
  }

  function missingSourceHistoryError(path) {
    const error = new Error(`No file history was found at ${path}. The Learn page may use a nonstandard source path.`);
    error.code = 'MISSING_SOURCE_HISTORY';
    return error;
  }

  function isMissingSourceHistoryError(error) {
    return error?.code === 'MISSING_SOURCE_HISTORY';
  }

  function revisionRefsFromSearchParams(searchParams, baseName = '_mx_base', headName = '_mx_head') {
    const base = (searchParams.get(baseName) || '').trim();
    const head = (searchParams.get(headName) || '').trim();
    if (!base && !head) return null;
    if (base && !head) throw new Error(`A ${baseName} revision also requires ${headName}.`);
    if ((base && !/^[0-9a-f]{7,40}$/i.test(base)) || !/^[0-9a-f]{7,40}$/i.test(head)) {
      throw new Error('Revision parameters must be Git commit SHAs between 7 and 40 hexadecimal characters.');
    }
    if (base && base.toLowerCase() === head.toLowerCase()) {
      throw new Error('The before and after revisions must be different.');
    }
    return { base: base || null, head };
  }

  function viewFromSearchParams(searchParams, name = '_mx_view') {
    const view = (searchParams.get(name) || 'visual').trim().toLowerCase();
    return VIEW_NAMES.has(view) ? view : 'visual';
  }

  function isLocalHostname(hostname) {
    return hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function isAllowedSiteOrigin(url) {
    return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHostname(url.hostname.toLowerCase()));
  }

  function resolveShortcutLocation(locationLike) {
    const href = typeof locationLike === 'string' ? locationLike : locationLike?.href;
    let pageUrl;
    try { pageUrl = new URL(href); } catch { throw new Error('The current page URL is invalid.'); }
    if (!isAllowedSiteOrigin(pageUrl)) {
      return { mode: 'unsupported-origin', pageUrl: pageUrl.href, targetUrl: null, refs: null, view: 'visual', routeStyle: null };
    }

    const queryTarget = pageUrl.searchParams.get('url');
    if (queryTarget && ROOT_PATHS.has(pageUrl.pathname)) {
      let target;
      try { target = new URL(queryTarget); } catch { throw new Error('The supplied documentation URL is invalid.'); }
      const refs = revisionRefsFromSearchParams(pageUrl.searchParams);
      const view = viewFromSearchParams(pageUrl.searchParams);
      return { mode: 'diff', pageUrl: pageUrl.href, targetUrl: target.href, refs, view, routeStyle: 'query' };
    }

    if (!LANDING_PATHS.has(pageUrl.pathname) && pageUrl.pathname.replaceAll('/', '')) {
      const target = new URL(`https://learn.microsoft.com${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
      const refs = revisionRefsFromSearchParams(target.searchParams);
      const view = viewFromSearchParams(target.searchParams);
      target.searchParams.delete('_mx_base');
      target.searchParams.delete('_mx_head');
      target.searchParams.delete('_mx_view');
      return { mode: 'diff', pageUrl: pageUrl.href, targetUrl: target.href, refs, view, routeStyle: 'path' };
    }

    return { mode: 'landing', pageUrl: pageUrl.href, targetUrl: null, refs: null, view: 'visual', routeStyle: null };
  }

  function viewUrlForState(pageHref, targetUrl, refs, view = 'visual') {
    let pageUrl;
    try { pageUrl = new URL(pageHref); } catch { throw new Error('The current page URL is invalid.'); }
    const pathRoute = !LANDING_PATHS.has(pageUrl.pathname);
    if (!pathRoute) pageUrl.searchParams.set('url', targetUrl);
    if (refs?.base) pageUrl.searchParams.set('_mx_base', refs.base);
    else pageUrl.searchParams.delete('_mx_base');
    if (refs?.head) pageUrl.searchParams.set('_mx_head', refs.head);
    else pageUrl.searchParams.delete('_mx_head');
    const selectedView = VIEW_NAMES.has(view) ? view : 'visual';
    if (selectedView === 'visual') pageUrl.searchParams.delete('_mx_view');
    else pageUrl.searchParams.set('_mx_view', selectedView);
    return pageUrl.href;
  }

  function diffUrlForLearnUrl(value, pageHref) {
    let input;
    try { input = new URL(String(value || '').trim()); } catch {
      throw unsupportedDocumentationError('Enter a complete documentation URL, including https://.');
    }
    const hostname = input.hostname.toLowerCase();
    const hasSafeOrigin = input.protocol === 'https:' && !input.port && !input.username && !input.password;
    const isLearnUrl = hasSafeOrigin && hostname === 'learn.microsoft.com';
    const isConfiguredSite = hasSafeOrigin && configuredSources().some(source => {
      try { return new URL(source.siteUrl).hostname.toLowerCase() === hostname; } catch { return false; }
    });
    if (!isLearnUrl && !isConfiguredSite) {
      throw unsupportedDocumentationError('Use a supported HTTPS documentation article URL.');
    }
    let pageUrl;
    try { pageUrl = new URL(pageHref || root.location?.href); } catch {
      throw new Error('The current Docs X-Ray URL is invalid.');
    }
    if (!isAllowedSiteOrigin(pageUrl)) throw new Error('Docs X-Ray requires HTTPS outside local development.');
    const target = new URL('/', pageUrl.origin);
    if (isLearnUrl) {
      target.pathname = input.pathname;
      target.search = input.search;
      target.hash = input.hash;
    } else {
      target.searchParams.set('url', input.href);
    }
    return target.href;
  }

  const shortcutUrlForLearnUrl = diffUrlForLearnUrl;

  function prepareShortcutLanding(document, locationLike) {
    let pageUrl;
    try { pageUrl = new URL(locationLike); } catch { return false; }
    if (!ROOT_PATHS.has(pageUrl.pathname) || pageUrl.hostname.toLowerCase().split('.')[0] !== 'learn') return false;

    const marketing = document.querySelector('[data-marketing-root]');
    const hero = marketing?.querySelector('.hero');
    const trySection = marketing?.querySelector('#try-it');
    if (!hero || !trySection) return false;

    document.body.classList.add('shortcut-landing');
    trySection.dataset.shortcutLanding = '';
    hero.insertAdjacentElement('afterend', trySection);

    const eyebrow = trySection.querySelector('.eyebrow');
    const heading = trySection.querySelector('h2');
    const introduction = trySection.querySelector('.section-heading p');
    const help = trySection.querySelector('.form-help');
    if (eyebrow) eyebrow.textContent = 'Start a page diff';
    if (heading) heading.textContent = 'Paste the Microsoft Learn page you want to compare.';
    if (introduction) introduction.textContent = 'The shortcut needs the article path from the original Learn URL. Paste the full address below, or add x after microsoft in that article’s address.';
    if (help) help.textContent = `Example: ${pageUrl.host}/en-us/entra/identity/…`;
    return true;
  }

  function decodePathSegment(segment) {
    let decoded;
    try { decoded = decodeURIComponent(segment); } catch { throw new Error('The documentation URL contains invalid path encoding.'); }
    if (!decoded || decoded === '.' || decoded === '..' || /[\\/\0]/.test(decoded)) {
      throw new Error('The documentation URL contains an unsafe path segment.');
    }
    return decoded;
  }

  function siteUrlToRepoInfo(value, sourceConfigs = configuredSources()) {
    let url;
    try { url = new URL(String(value || '').trim()); } catch {
      throw unsupportedDocumentationError('Enter a complete documentation URL, including https://.');
    }
    if (url.protocol !== 'https:' || url.port || url.username || url.password) {
      throw unsupportedDocumentationError('Documentation URLs must use a standard HTTPS origin without credentials.');
    }
    const inputSegments = url.pathname.split('/').filter(Boolean).map(decodePathSegment);
    let match = null;

    for (const source of sourceConfigs) {
      let site;
      let repository;
      try {
        site = new URL(source.siteUrl);
        repository = new URL(source.repositoryUrl);
      } catch { continue; }
      if (site.protocol !== 'https:' || site.hostname.toLowerCase() !== url.hostname.toLowerCase()) continue;
      if (repository.protocol !== 'https:' || repository.hostname.toLowerCase() !== 'github.com') continue;
      const requiredQuery = source.query && typeof source.query === 'object' ? source.query : {};
      if (Object.entries(requiredQuery).some(([name, expected]) => url.searchParams.get(name) !== String(expected))) continue;

      const segments = [...inputSegments];
      if (source.stripLocale && /^[a-z]{2}-[a-z]{2}$/i.test(segments[0] || '')) segments.shift();
      const prefix = site.pathname.split('/').filter(Boolean).map(decodePathSegment);
      if (!prefix.every((segment, index) => segments[index]?.toLowerCase() === segment.toLowerCase())) continue;
      const articleSegments = segments.slice(prefix.length);
      if (!articleSegments.length) continue;
      match = { source, site, repository, articleSegments };
      break;
    }

    if (!match) throw unsupportedDocumentationError(`This documentation path is not supported yet: ${url.pathname}`);
    const { source, site, repository, articleSegments } = match;
    const finalIndex = articleSegments.length - 1;
    articleSegments[finalIndex] = articleSegments[finalIndex].replace(/\.(?:mdx?|html?)$/i, '');
    if (!articleSegments[finalIndex]) throw unsupportedDocumentationError('Use a documentation article URL, not a section landing page.');

    const repositoryParts = repository.pathname.split('/').filter(Boolean);
    if (repositoryParts.length !== 2) throw new Error(`The source configuration for ${source.label} has an invalid repository URL.`);
    const [owner, repo] = repositoryParts;
    const articlePath = articleSegments.join('/');
    const mappedArticlePath = String(source.pathAliases?.[articlePath] || articlePath).replace(/^\/+|\/+$/g, '');
    const mappedSegments = mappedArticlePath.split('/').filter(Boolean).map(decodePathSegment);
    if (!mappedSegments.length) throw new Error(`The path mapping for ${source.label} is invalid.`);

    const repositoryPathPrefix = String(source.repositoryPathPrefix || '').replace(/^\/+|\/+$/g, '');
    const fileExtensionValue = String(source.fileExtension || '.md');
    const fileExtension = fileExtensionValue.startsWith('.') ? fileExtensionValue : `.${fileExtensionValue}`;
    const path = [repositoryPathPrefix, `${mappedSegments.join('/')}${fileExtension}`].filter(Boolean).join('/');
    const defaultBranch = source.defaultBranch || 'main';
    const githubRoot = `https://github.com/${owner}/${repo}`;
    return {
      sourceId: source.id,
      sourceLabel: source.label,
      siteLabel: source.siteLabel || (site.hostname.toLowerCase() === 'learn.microsoft.com' ? 'Microsoft Learn' : site.hostname),
      publicUrl: url.href,
      siteRoot: site.href.endsWith('/') ? site.href : `${site.href}/`,
      owner,
      repo,
      repository: `${owner}/${repo}`,
      defaultBranch,
      path,
      sourceResolution: source.sourceResolution || 'static',
      apiRoot: `https://api.github.com/repos/${owner}/${repo}`,
      githubRoot,
      githubUrl: `${githubRoot}/blob/${encodeURIComponent(defaultBranch)}/${path}`,
      historyUrl: `${githubRoot}/commits/${encodeURIComponent(defaultBranch)}/${path}`
    };
  }

  function microsoftDocsSourceToRepoInfo(publicValue, sourceValue) {
    let publicUrl;
    let sourceUrl;
    try {
      publicUrl = new URL(String(publicValue || '').trim());
      sourceUrl = new URL(String(sourceValue || '').trim());
    } catch {
      throw unsupportedDocumentationError('Microsoft Learn returned an invalid public source URL.');
    }
    if (publicUrl.protocol !== 'https:' || publicUrl.hostname.toLowerCase() !== 'learn.microsoft.com') {
      throw unsupportedDocumentationError('Only https://learn.microsoft.com article URLs are supported.');
    }
    if (
      sourceUrl.protocol !== 'https:' ||
      sourceUrl.hostname.toLowerCase() !== 'github.com' ||
      sourceUrl.port ||
      sourceUrl.username ||
      sourceUrl.password ||
      sourceUrl.search ||
      sourceUrl.hash
    ) {
      throw unsupportedDocumentationError('Microsoft Learn returned an unsupported public source URL.');
    }

    const segments = sourceUrl.pathname.split('/').filter(Boolean);
    if (segments.length < 5 || segments[2].toLowerCase() !== 'blob') {
      throw unsupportedDocumentationError('Microsoft Learn returned an unsupported public source URL.');
    }
    const owner = decodePathSegment(segments[0]);
    const repo = decodePathSegment(segments[1]);
    const defaultBranch = decodePathSegment(segments[3]);
    const path = segments.slice(4).map(decodePathSegment).join('/');
    if (owner.toLowerCase() !== 'microsoftdocs' || !/^[a-z0-9._-]+$/i.test(repo)) {
      throw unsupportedDocumentationError('The public source is not in the MicrosoftDocs organization.');
    }
    if (!/\.(?:mdx?|markdown|ya?ml)$/i.test(path)) {
      throw unsupportedDocumentationError('The public source is not a supported documentation file.');
    }

    const githubRoot = `https://github.com/${owner}/${repo}`;
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return {
      sourceId: 'microsoftdocs-resolved',
      sourceLabel: `${owner}/${repo}`,
      siteLabel: 'Microsoft Learn',
      publicUrl: publicUrl.href,
      siteRoot: 'https://learn.microsoft.com/',
      owner,
      repo,
      repository: `${owner}/${repo}`,
      defaultBranch,
      path,
      sourceResolution: 'resolved',
      apiRoot: `https://api.github.com/repos/${owner}/${repo}`,
      githubRoot,
      githubUrl: `${githubRoot}/blob/${encodeURIComponent(defaultBranch)}/${encodedPath}`,
      historyUrl: `${githubRoot}/commits/${encodeURIComponent(defaultBranch)}/${encodedPath}`
    };
  }

  async function resolvedMicrosoftDocsSource(value, fetchImpl = root.fetch) {
    if (typeof fetchImpl !== 'function') throw new Error('Microsoft Learn source lookup is unavailable.');
    const base = root.location?.origin || 'https://microsoftx.invalid';
    const endpoint = new URL('/api/resolve-source', base);
    endpoint.searchParams.set('url', String(value || '').trim());
    const response = await fetchImpl(endpoint.href, { headers: { Accept: 'application/json' } });
    let payload = {};
    try { payload = await response.json(); } catch {}
    if (response.status === 400 || response.status === 404) {
      throw unsupportedDocumentationError(payload.error || 'This Microsoft Learn path does not expose a public MicrosoftDocs source.');
    }
    if (!response.ok) throw new Error(payload.error || `Microsoft Learn source lookup returned ${response.status}.`);
    return microsoftDocsSourceToRepoInfo(value, payload.sourceUrl);
  }

  async function resolveSiteUrlToRepoInfo(value, sourceConfigs = configuredSources(), fetchImpl = root.fetch) {
    let configured = null;
    let configuredError = null;
    try { configured = siteUrlToRepoInfo(value, sourceConfigs); } catch (error) {
      configuredError = error;
      if (!isUnsupportedDocumentationError(error)) throw error;
    }
    if (configured && configured.sourceResolution !== 'verify') return configured;

    try { return await resolvedMicrosoftDocsSource(value, fetchImpl); } catch (error) {
      if (configured) return configured;
      if (isUnsupportedDocumentationError(error) && configuredError) throw configuredError;
      throw error;
    }
  }

  function apiPath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function githubFileUrl(info, ref) {
    return `${info.githubRoot}/blob/${encodeURIComponent(ref || info.defaultBranch)}/${apiPath(info.path)}`;
  }

  function extractTitle(markdown, fallback) {
    const frontMatter = String(markdown || '').match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
    const title = frontMatter?.[1].match(/^title:\s*["']?(.+?)["']?\s*$/mi);
    const heading = String(markdown || '').match(/^#\s+(.+)$/m);
    return title?.[1] || heading?.[1] || fallback;
  }

  function stripFrontMatter(markdown) {
    return String(markdown || '').replace(/^---\s*\r?\n[\s\S]*?\r?\n---\s*\r?\n?/, '');
  }

  function firstLine(value) {
    return String(value || '').split('\n')[0];
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function countChangedLines(parts) {
    return parts.reduce((counts, part) => {
      const lineCount = part.count || Math.max(0, part.value.split('\n').length - 1);
      if (part.added) counts.additions += lineCount;
      if (part.removed) counts.deletions += lineCount;
      return counts;
    }, { additions: 0, deletions: 0 });
  }

  function markdownForRendering(markdown) {
    return stripFrontMatter(markdown)
      .replace(/:::image\s+([^\n]*?):::/g, (_match, attributes) => {
        const source = attributes.match(/\bsource="([^"]+)"/i)?.[1] || '';
        const alt = attributes.match(/\balt-text="([^"]*)"/i)?.[1] || '';
        return source ? `![${alt.replace(/]/g, '\\]')}](${source})` : '';
      })
      .replace(/^:::(?:moniker|zone|row|column|code)[^\n]*$/gm, '')
      .replace(/^:::\s*$/gm, '');
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(value);
      return ['https:', 'mailto:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  }

  function resolveContentUrl(value, info, ref, type) {
    const candidate = String(value || '').trim();
    if (!candidate || candidate.startsWith('#')) return candidate;
    if (/^(https?:|mailto:|javascript:|data:|vbscript:)/i.test(candidate)) return safeExternalUrl(candidate);
    if (candidate.startsWith('~/')) {
      try { return new URL(candidate.slice(2).replace(/\.mdx?(?=($|[?#]))/i, ''), info.siteRoot).href; } catch { return ''; }
    }
    if (candidate.startsWith('/')) {
      try { return new URL(candidate.replace(/\.mdx?(?=($|[?#]))/i, ''), info.siteRoot).href; } catch { return ''; }
    }
    if (type === 'src') {
      const directory = info.path.split('/').slice(0, -1).join('/');
      return `https://raw.githubusercontent.com/${info.repository}/${encodeURIComponent(ref)}/${directory}/${candidate}`;
    }
    try {
      const publicBase = new URL(info.publicUrl);
      publicBase.hash = '';
      publicBase.search = '';
      publicBase.pathname = `${publicBase.pathname.slice(0, publicBase.pathname.lastIndexOf('/') + 1)}`;
      return new URL(candidate.replace(/\.mdx?(?=($|[?#]))/i, ''), publicBase).href;
    } catch { return ''; }
  }

  function sanitizeRenderedHtml(html, info, ref) {
    if (!root.DOMParser) throw new Error('The browser HTML parser is unavailable.');
    const parsed = new root.DOMParser().parseFromString(`<main>${html}</main>`, 'text/html');
    parsed.querySelectorAll('script,style,link,meta,base,iframe,object,embed,form,input,button,textarea,select,svg,math').forEach(node => node.remove());
    parsed.querySelectorAll('*').forEach(node => {
      for (const attribute of [...node.attributes]) {
        if (!['href', 'src', 'alt', 'title', 'colspan', 'rowspan'].includes(attribute.name.toLowerCase())) node.removeAttribute(attribute.name);
      }
      if (node.hasAttribute('href')) {
        const href = resolveContentUrl(node.getAttribute('href'), info, ref, 'href');
        if (href) node.setAttribute('href', href); else node.removeAttribute('href');
      }
      if (node.hasAttribute('src')) {
        const src = resolveContentUrl(node.getAttribute('src'), info, ref, 'src');
        if (src) node.setAttribute('src', src); else node.removeAttribute('src');
      }
      if (node.tagName === 'IMG') node.setAttribute('loading', 'lazy');
      if (node.tagName === 'A') {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    parsed.querySelectorAll('blockquote').forEach(block => {
      const firstParagraph = block.querySelector('p');
      const match = firstParagraph?.textContent.match(/^\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*/i);
      if (!match) return;
      const type = match[1].toLowerCase();
      firstParagraph.textContent = firstParagraph.textContent.replace(/^\[!(NOTE|TIP|IMPORTANT|CAUTION|WARNING)\]\s*/i, '');
      block.className = `learn-alert learn-alert-${type}`;
      const title = parsed.createElement('div');
      title.className = 'learn-alert-title';
      title.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      block.insertBefore(title, block.firstChild);
    });
    return parsed.querySelector('main').innerHTML;
  }

  function renderMarkdown(markdown, info, ref) {
    if (!root.marked?.parse) throw new Error('The Markdown renderer did not load.');
    const html = root.marked.parse(markdownForRendering(markdown), { async: false });
    return sanitizeRenderedHtml(html, info, ref);
  }

  function renderVisualDiff(before, after, info, _baseRef, headRef) {
    if (typeof root.htmldiff !== 'function') throw new Error('The visual diff engine did not load.');
    const oldHtml = renderMarkdown(before, info, headRef);
    const newHtml = renderMarkdown(after, info, headRef);
    const html = root.htmldiff(oldHtml, newHtml);
    const isNewFile = !String(before || '').trim() && Boolean(String(after || '').trim());
    const notice = isNewFile
      ? '<aside class="new-file-notice" role="note"><span class="new-file-badge">New page</span><div><strong>This page did not exist before this revision.</strong><p>The full page is shown below as added content.</p></div></aside>'
      : '';
    return html.trim() ? `${notice}<div class="rich-diff">${html}</div>` : '<p class="quiet">No rendered content changed.</p>';
  }

  function renderMarkdownDiff(before, after, info, baseRef, headRef) {
    if (!root.Diff?.createTwoFilesPatch) throw new Error('The Markdown diff engine did not load.');
    const isNewFile = !String(before || '').trim() && Boolean(String(after || '').trim());
    const patch = root.Diff.createTwoFilesPatch(
      `${info.path} @ ${isNewFile ? 'new file' : String(baseRef || 'unknown').slice(0, 7)}`,
      `${info.path} @ ${headRef.slice(0, 7)}`,
      before,
      after,
      '',
      '',
      { context: 4 }
    );
    const lines = patch.split('\n').map(line => {
      let kind = 'context';
      if (/^@@/.test(line)) kind = 'hunk';
      else if (/^(Index:|={3,}|\\ No newline)/.test(line)) kind = 'meta';
      else if (/^\+\+\+/.test(line)) kind = 'file-new';
      else if (/^---/.test(line)) kind = 'file-old';
      else if (line.startsWith('+')) kind = 'added';
      else if (line.startsWith('-')) kind = 'removed';
      return `<span class="markdown-diff-line ${kind}">${escapeHtml(line || ' ')}</span>`;
    }).join('');
    const notice = isNewFile
      ? '<aside class="new-file-notice" role="note"><span class="new-file-badge">New page</span><div><strong>This page did not exist before this revision.</strong><p>The full file is shown below as added content.</p></div></aside>'
      : '';
    return `${notice}<div class="markdown-diff" role="region" aria-label="Markdown Git diff"><pre><code>${lines}</code></pre></div>`;
  }

  async function request(endpoint, token, accept) {
    let url;
    try { url = new URL(endpoint); } catch { throw new Error('An invalid GitHub API request was blocked.'); }
    if (url.protocol !== 'https:' || url.hostname !== 'api.github.com') {
      throw new Error('A request outside api.github.com was blocked.');
    }
    const headers = {
      Accept: accept || 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await root.fetch(url.href, { headers });
    const remaining = response.headers.get('x-ratelimit-remaining');
    const reset = response.headers.get('x-ratelimit-reset');
    if (!response.ok) {
      let message = `GitHub returned ${response.status}.`;
      try { message = (await response.json()).message || message; } catch {}
      const rateLimited = response.status === 429 || (response.status === 403 && remaining === '0');
      if (rateLimited) {
        const resetDate = reset ? new Date(Number(reset) * 1000) : null;
        const resetText = resetDate && !Number.isNaN(resetDate.getTime())
          ? ` Try again after ${new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(resetDate)}.`
          : '';
        message = token
          ? `This GitHub token has reached its API limit.${resetText}`
          : `GitHub's anonymous API limit has been reached.${resetText}`;
      } else if (response.status === 401) {
        message = 'GitHub rejected the saved token. Remove or replace it in API settings.';
      } else if (response.status === 404) {
        message = 'The mapped source file or revision was not found on GitHub.';
      }
      const error = new Error(message);
      error.status = response.status;
      error.rateLimited = rateLimited;
      error.resetAt = reset ? Number(reset) * 1000 : null;
      throw error;
    }
    return accept === 'application/vnd.github.raw+json' ? response.text() : response.json();
  }

  async function loadHistory(info, token, page = 1, perPage = HISTORY_PAGE_SIZE, ref = info.defaultBranch) {
    const encodedPath = apiPath(info.path);
    const endpoint = `${info.apiRoot}/commits?path=${encodedPath}&sha=${encodeURIComponent(ref)}&per_page=${perPage}&page=${page}`;
    const commits = await request(endpoint, token);
    if (!Array.isArray(commits)) throw new Error('GitHub returned an invalid file history.');
    return commits;
  }

  async function rawRevision(info, token, ref) {
    const encodedPath = apiPath(info.path);
    const rawUrl = ref => `${info.apiRoot}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
    return request(rawUrl(ref), token, 'application/vnd.github.raw+json')
      .catch(error => error.status === 404 ? '' : Promise.reject(error));
  }

  async function loadComparison(info, token, refs, suppliedHistory) {
    let history = suppliedHistory;
    if (!refs && !history) history = await loadHistory(info, token, 1, 2);

    const findCommit = ref => history?.find(commit => commit.sha.toLowerCase() === String(ref || '').toLowerCase()) || null;
    const commitAt = async ref => findCommit(ref) || request(`${info.apiRoot}/commits/${encodeURIComponent(ref)}`, token);

    if (refs) {
      const headCommit = await commitAt(refs.head);
      const baseRef = refs.base || headCommit.parents?.[0]?.sha || '';
      if (!baseRef) throw new Error('The selected after revision does not have a parent to compare.');
      const [baseCommit, before, after] = await Promise.all([
        commitAt(baseRef),
        rawRevision(info, token, baseRef),
        rawRevision(info, token, refs.head)
      ]);
      return { info, headCommit, baseCommit, after, before };
    }

    if (!Array.isArray(history) || !history.length) {
      throw missingSourceHistoryError(info.path);
    }
    const headCommit = history[0];
    const baseCommit = history[1] || null;
    const [after, before] = await Promise.all([
      rawRevision(info, token, headCommit.sha),
      baseCommit ? rawRevision(info, token, baseCommit.sha) : Promise.resolve('')
    ]);
    return { info, headCommit, baseCommit, after, before };
  }

  function setStatus(element, message, state = '') {
    if (!element) return;
    element.hidden = !message;
    element.className = `compare-status ${state}`.trim();
    element.textContent = message || '';
  }

  function setLoadingSurface(diffPage, phase, active = true) {
    const loading = diffPage?.querySelector('[data-diff-loading]');
    if (!loading) return;
    const body = diffPage.ownerDocument?.body;
    if (!active) {
      loading.hidden = true;
      diffPage.classList.remove('is-loading');
      diffPage.removeAttribute('data-loading-state');
      diffPage.removeAttribute('aria-busy');
      body?.classList.remove('diff-loading-open');
      return;
    }

    const selected = LOADING_PHASES[phase] || LOADING_PHASES.mapping;
    const phaseNames = Object.keys(LOADING_PHASES);
    const selectedIndex = phaseNames.indexOf(phase in LOADING_PHASES ? phase : 'mapping');
    diffPage.classList.add('is-loading');
    diffPage.dataset.loadingState = phaseNames[selectedIndex];
    diffPage.setAttribute('aria-busy', 'true');
    body?.classList.add('diff-loading-open');
    loading.hidden = false;
    const loadingTitle = loading.querySelector('[data-loading-title]');
    const loadingMessage = loading.querySelector('[data-loading-message]');
    if (loadingTitle) loadingTitle.textContent = selected.title;
    if (loadingMessage) loadingMessage.textContent = selected.message;
    const progress = loading.querySelector('[data-loading-progress]');
    if (progress) {
      progress.setAttribute('aria-valuenow', String(selected.progress));
      progress.setAttribute('aria-valuetext', selected.aria);
    }
    loading.querySelectorAll('[data-loading-phase]').forEach((item, index) => {
      item.classList.toggle('is-complete', index < selectedIndex);
      item.classList.toggle('is-active', index === selectedIndex);
    });
  }

  function remainingLoadingDuration(startedAt, now = Date.now(), minimumDuration = MINIMUM_LOADING_DURATION) {
    const elapsed = Math.max(0, Number(now) - Number(startedAt));
    return Math.max(0, Number(minimumDuration) - elapsed);
  }

  function waitForMinimumLoading(startedAt) {
    const remaining = remainingLoadingDuration(startedAt);
    return remaining > 0
      ? new Promise(resolve => root.setTimeout(resolve, remaining))
      : Promise.resolve();
  }

  function scrollPageToTop(target = root) {
    if (typeof target?.scrollTo !== 'function') return;
    target.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }

  function navigateBackOrHome(target = root) {
    if (Number(target?.history?.length) > 1 && typeof target.history.back === 'function') {
      target.history.back();
      return 'back';
    }
    if (typeof target?.location?.assign === 'function') {
      target.location.assign(new URL('/', target.location.href).href);
    }
    return 'home';
  }

  function restoreFromUnsupportedHistory(document, target = root) {
    if (!document?.body?.classList.contains('unsupported-mode')) return false;
    if (typeof target?.location?.reload === 'function') target.location.reload();
    return true;
  }

  function showUnsupportedPage(document, target = root, createHistoryEntry = false) {
    const unsupportedPage = document?.querySelector('[data-unsupported-page]');
    if (!unsupportedPage) return false;

    if (createHistoryEntry && typeof target?.history?.pushState === 'function') {
      target.history.pushState({ microsoftXUnsupported: true }, '', target.location?.href);
    }

    const marketing = document.querySelector('[data-marketing-root]');
    const diffPage = document.querySelector('[data-diff-page]');
    setLoadingSurface(diffPage, '', false);
    [marketing, diffPage].forEach(page => {
      if (!page) return;
      page.hidden = true;
      page.removeAttribute('id');
    });
    document.querySelectorAll('.skip-link, .independent-bar, .site-header, .site-footer').forEach(element => element.remove());
    unsupportedPage.hidden = false;
    unsupportedPage.id = 'main-content';
    document.body?.classList.remove('diff-mode', 'diff-loading-open', 'shortcut-landing', 'missing-source-mode');
    document.body?.classList.add('unsupported-mode');
    document.title = 'Unsupported documentation — Microsoft Docs X-Ray';
    addNoIndex(document);
    scrollPageToTop(target);
    return true;
  }

  function showMissingSourcePage(document, error, target = root) {
    const diffPage = document?.querySelector('[data-diff-page]');
    const missingPage = diffPage?.querySelector('[data-missing-source-page]');
    if (!diffPage || !missingPage) return false;

    setLoadingSurface(diffPage, '', false);
    const message = missingPage.querySelector('[data-missing-source-message]');
    if (message) message.textContent = error?.message || 'No public GitHub history was found for this Microsoft Learn page.';
    const hero = diffPage.querySelector('.diff-hero');
    const intro = diffPage.querySelector('[data-diff-intro]');
    const results = diffPage.querySelector('[data-compare-results]');
    const navigator = diffPage.querySelector('[data-diff-navigator]');
    const status = diffPage.querySelector('[data-compare-status]');
    if (hero) hero.hidden = true;
    if (intro) intro.hidden = true;
    if (results) results.hidden = true;
    if (navigator) navigator.hidden = true;
    setStatus(status, '', '');
    missingPage.hidden = false;
    document.body?.classList.add('missing-source-mode');
    document.title = 'Page history not found — Microsoft Docs X-Ray';
    addNoIndex(document);
    scrollPageToTop(target);
    return true;
  }

  function commitDate(commit) {
    return commit?.commit?.author?.date || commit?.commit?.committer?.date || '';
  }

  function commitOption(commit, label) {
    const date = commitDate(commit);
    const formattedDate = date ? formatDate(date) : 'Unknown date';
    const text = `${label ? `${label} · ${formattedDate}` : formattedDate} — ${firstLine(commit.commit?.message) || 'Documentation update'}`;
    return `<option value="${escapeHtml(commit.sha)}">${escapeHtml(text)}</option>`;
  }

  function comparisonSummary(comparison) {
    const revision = (commit, label) => {
      if (!commit) return `<div><span>${label}</span><strong>New file</strong></div>`;
      const date = commitDate(commit);
      return `<div><span>${label}</span><a href="${escapeHtml(commit.html_url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(date ? formatDate(date) : 'Unknown date')}</strong><small>${escapeHtml(firstLine(commit.commit?.message) || 'Documentation update')}</small></a></div>`;
    };
    return `${revision(comparison.baseCommit, 'From')}<span class="comparison-arrow" aria-hidden="true">→</span>${revision(comparison.headCommit, 'To')}`;
  }

  function historyExplorer(history, comparison, hasMore) {
    const baseSha = comparison.baseCommit?.sha || '';
    const headSha = comparison.headCommit?.sha || '';
    const latestSha = history[0]?.sha || '';
    const knownCommits = [...history];
    for (const commit of [comparison.headCommit, comparison.baseCommit]) {
      if (commit && !knownCommits.some(item => item.sha === commit.sha)) knownCommits.push(commit);
    }
    knownCommits.sort((left, right) => new Date(commitDate(right)).getTime() - new Date(commitDate(left)).getTime());
    const options = knownCommits.map((commit, index) => commitOption(commit, index === 0 && commit.sha === latestSha ? 'Current version' : '')).join('');
    const timeline = history.map((commit, index) => {
      const date = commitDate(commit);
      const selected = commit.sha === baseSha || commit.sha === headSha;
      const role = commit.sha === baseSha ? 'From' : (commit.sha === headSha ? 'To' : '');
      const action = index === 0 ? 'Show latest change' : 'Compare from here to current';
      const formattedDate = date ? formatDate(date) : 'Unknown date';
      const dateLabel = index === 0 ? `Current version · ${formattedDate}` : formattedDate;
      return `<li class="version-event${selected ? ' selected' : ''}${index === 0 ? ' current' : ''}"><span class="version-node" aria-hidden="true"></span><button type="button" data-history-from="${escapeHtml(commit.sha)}" aria-pressed="${selected}"><span class="version-date">${escapeHtml(dateLabel)}${role ? `<em>${role}</em>` : ''}</span><strong>${escapeHtml(firstLine(commit.commit?.message) || 'Documentation update')}</strong><small>${action}</small></button></li>`;
    }).join('');
    return `<section class="version-explorer" id="versions" aria-labelledby="version-history-heading"><header><div><span class="eyebrow">Version history</span><h2 id="version-history-heading">Choose a point in time</h2><p>Select any change to compare that version with the current page.</p></div><button class="share-view-button" type="button" data-share-view aria-label="Copy link to this view" title="Copy link to this view"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a3 3 0 1 0-2.83-4A3 3 0 0 0 15 5c0 .18.02.36.05.53L8.91 9.06A3 3 0 0 0 7 8.35a3 3 0 1 0 1.91 5.59l6.14 3.53A3 3 0 0 0 15 18a3 3 0 1 0 .83-2.07L9.7 12.4a3.1 3.1 0 0 0 0-.8l6.13-3.53A3 3 0 0 0 18 8Z"/></svg></button></header><div class="version-layout"><div><ol class="version-timeline" data-version-timeline>${timeline}</ol>${hasMore ? '<button class="load-history-button" type="button" data-load-older>Load older versions</button>' : ''}</div><aside class="comparison-controls"><span class="eyebrow">Current comparison</span><div class="comparison-range" data-comparison-summary>${comparisonSummary(comparison)}</div><button class="latest-change-button" type="button" data-compare-latest>Show latest change</button><details><summary>Advanced: compare any two versions</summary><div class="advanced-comparison"><label>Earlier version<select data-comparison-base>${options}</select></label><label>Later version<select data-comparison-head>${options}</select></label><button class="button-primary" type="button" data-compare-selected>Compare selected versions</button><p data-comparison-error role="status"></p></div></details><p class="share-view-status" data-share-status role="status" aria-live="polite"></p></aside></div></section>`;
  }

  function setHistorySelections(container, comparison) {
    const baseSelect = container.querySelector('[data-comparison-base]');
    const headSelect = container.querySelector('[data-comparison-head]');
    if (baseSelect && comparison.baseCommit) baseSelect.value = comparison.baseCommit.sha;
    if (headSelect && comparison.headCommit) headSelect.value = comparison.headCommit.sha;
  }

  function comparisonDescription(comparison, history) {
    const isLatest = comparison.headCommit?.sha === history[0]?.sha && comparison.baseCommit?.sha === history[1]?.sha;
    if (isLatest) return 'in the latest change';
    if (comparison.headCommit?.sha === history[0]?.sha) return `since ${formatDate(commitDate(comparison.baseCommit))}`;
    return `between ${formatDate(commitDate(comparison.baseCommit))} and ${formatDate(commitDate(comparison.headCommit))}`;
  }

  function validateComparisonRefs(history, base, head) {
    if (!base || !head) throw new Error('Choose both an earlier and later version.');
    if (base === head) throw new Error('Choose two different versions.');
    const baseIndex = history.findIndex(commit => commit.sha === base);
    const headIndex = history.findIndex(commit => commit.sha === head);
    if (baseIndex >= 0 && headIndex >= 0 && baseIndex < headIndex) {
      throw new Error('The earlier version must come before the later version.');
    }
    return { base, head };
  }

  function addNoIndex(document) {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';
  }

  function setCanonical(document, href) {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = href;
  }

  function setupTabs(document, onChange) {
    const buttons = [...document.querySelectorAll('[data-diff-tab]')];
    function select(name, notify = true) {
      const button = buttons.find(item => item.dataset.diffTab === name) || buttons[0];
      buttons.forEach(item => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      document.querySelectorAll('[data-diff-panel]').forEach(panel => {
        panel.hidden = panel.dataset.diffPanel !== button.dataset.diffTab;
      });
      if (notify) onChange?.(button.dataset.diffTab);
    }
    buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.diffTab)));
    return { select };
  }

  const VISUAL_DIFF_BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,tr,pre,blockquote';

  function continuousVisualDiffGroups(panel) {
    if (!panel) return [];
    const blocks = [...panel.querySelectorAll(VISUAL_DIFF_BLOCKS)]
      .filter(block => !block.querySelector(VISUAL_DIFF_BLOCKS));
    const groups = [];
    let currentGroup = null;

    blocks.forEach(block => {
      const changed = Boolean(block.matches('ins,del') || block.closest('ins,del') || block.querySelector('ins,del'));
      if (!changed) {
        currentGroup = null;
        return;
      }
      if (!currentGroup) {
        currentGroup = [];
        groups.push(currentGroup);
      }
      currentGroup.push(block);
    });

    if (groups.length) return groups;
    const inlineChanges = [...panel.querySelectorAll('ins,del')];
    return inlineChanges.length ? [[inlineChanges[0]]] : [];
  }

  function continuousMarkdownDiffGroups(panel) {
    if (!panel) return [];
    const hunks = [...panel.querySelectorAll('.markdown-diff-line.hunk')];
    if (hunks.length) return hunks.map(hunk => [hunk]);

    const groups = [];
    let currentGroup = null;
    panel.querySelectorAll('.markdown-diff-line').forEach(line => {
      const changed = line.classList.contains('added') || line.classList.contains('removed');
      if (!changed) {
        currentGroup = null;
        return;
      }
      if (!currentGroup) {
        currentGroup = [];
        groups.push(currentGroup);
      }
      currentGroup.push(line);
    });
    return groups;
  }

  function createDiffNavigator(document) {
    const nav = document.querySelector('[data-diff-navigator]');
    const diffRoot = document.querySelector('[data-diff-content]');
    if (!nav || !diffRoot) return { refresh() {}, hide() {} };
    const label = nav.querySelector('[data-diff-position]');
    const previous = nav.querySelector('[data-diff-previous]');
    const next = nav.querySelector('[data-diff-next]');
    let targetGroups = [];
    let index = -1;
    let positionFrame = null;

    function positionNavigator() {
      positionFrame = null;
      const bannerBottom = document.querySelector('.diff-hero')?.getBoundingClientRect().bottom || 0;
      nav.style.top = `${Math.max(12, bannerBottom + 8)}px`;
    }

    function scheduleNavigatorPosition() {
      if (positionFrame !== null) return;
      if (typeof root.requestAnimationFrame === 'function') {
        positionFrame = root.requestAnimationFrame(positionNavigator);
      } else {
        positionNavigator();
      }
    }

    function refresh() {
      diffRoot.querySelectorAll('.diff-jump-target,.diff-jump-active').forEach(node => node.classList.remove('diff-jump-target', 'diff-jump-active'));
      index = -1;
      const panel = diffRoot.querySelector('[data-diff-panel]:not([hidden])');
      if (!panel) return hide();
      targetGroups = panel.dataset.diffPanel === 'markdown'
        ? continuousMarkdownDiffGroups(panel)
        : continuousVisualDiffGroups(panel);
      targetGroups.flat().forEach(target => target.classList.add('diff-jump-target'));
      nav.hidden = !targetGroups.length;
      label.textContent = `${targetGroups.length} change${targetGroups.length === 1 ? '' : 's'}`;
      positionNavigator();
    }

    function hide() {
      targetGroups = [];
      index = -1;
      nav.hidden = true;
    }

    function move(amount) {
      if (!targetGroups.length) return;
      index = index < 0 ? (amount > 0 ? 0 : targetGroups.length - 1) : (index + amount + targetGroups.length) % targetGroups.length;
      targetGroups.forEach((group, groupIndex) => group.forEach((target, targetIndex) => {
        target.classList.toggle('diff-jump-active', groupIndex === index && targetIndex === 0);
      }));
      label.textContent = `${index + 1} of ${targetGroups.length}`;
      targetGroups[index][0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    root.addEventListener('scroll', scheduleNavigatorPosition, { passive: true });
    root.addEventListener('resize', scheduleNavigatorPosition);
    return { refresh, hide };
  }

  function savedToken() {
    try { return root.localStorage.getItem(TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
  }

  function init() {
    const document = root.document;
    if (!document) return;
    let context;
    try { context = resolveShortcutLocation(root.location.href); } catch (error) {
      context = { mode: 'error', error, targetUrl: null, refs: null };
    }

    const unsupportedBack = document.querySelector('[data-unsupported-back]');
    unsupportedBack?.addEventListener('click', event => {
      event.preventDefault();
      navigateBackOrHome(root);
    });
    root.addEventListener('popstate', () => restoreFromUnsupportedHistory(document, root));

    document.querySelectorAll('[data-home-url-form]').forEach(homeForm => {
      const homeStatus = homeForm.querySelector('[data-home-url-status]');
      homeForm.addEventListener('submit', event => {
        event.preventDefault();
        try {
          const value = homeForm.elements.url.value;
          const shortcut = diffUrlForLearnUrl(value, root.location.href);
          root.location.assign(shortcut);
        } catch (error) {
          if (!showUnsupportedPage(document, root, true)) setStatus(homeStatus, error.message, 'error');
        }
      });
    });

    if (context.mode === 'landing') prepareShortcutLanding(document, root.location.href);
    if (context.mode === 'unsupported-origin') {
      showUnsupportedPage(document);
      return;
    }

    if (context.mode === 'diff') addNoIndex(document);
    if (context.mode !== 'diff' && context.mode !== 'error') return;

    const marketing = document.querySelector('[data-marketing-root]');
    const diffPage = document.querySelector('[data-diff-page]');
    if (!diffPage) return;
    marketing.removeAttribute('id');
    diffPage.id = 'main-content';
    marketing.hidden = true;
    diffPage.hidden = false;
    document.body.classList.add('diff-mode');
    const form = diffPage.querySelector('[data-diff-form]');
    const input = form.querySelector('[name="learn-url"]');
    const submit = form.querySelector('button[type="submit"]');
    const status = diffPage.querySelector('[data-compare-status]');
    const results = diffPage.querySelector('[data-compare-results]');
    const intro = diffPage.querySelector('[data-diff-intro]');
    const navigator = createDiffNavigator(document);
    let currentInfo = null;
    let currentHistory = [];
    let currentComparison = null;
    let currentView = context.view || 'visual';
    let historyPage = 1;
    let historyHasMore = false;
    let initialRequest = true;
    let retryAfterTokenChange = null;

    function exactRefs() {
      if (!currentComparison?.headCommit) return null;
      return {
        base: currentComparison.baseCommit?.sha || null,
        head: currentComparison.headCommit.sha
      };
    }

    function syncViewUrl() {
      const refs = exactRefs();
      if (!refs || !currentInfo) return;
      const url = viewUrlForState(root.location.href, currentInfo.publicUrl, refs, currentView);
      root.history.replaceState(null, '', url);
    }

    async function copyViewUrl(button) {
      syncViewUrl();
      const shareStatus = results.querySelector('[data-share-status]');
      try {
        if (root.navigator?.clipboard?.writeText) await root.navigator.clipboard.writeText(root.location.href);
        else {
          const temporary = document.createElement('textarea');
          temporary.value = root.location.href;
          temporary.setAttribute('readonly', '');
          temporary.style.position = 'fixed';
          temporary.style.opacity = '0';
          document.body.appendChild(temporary);
          temporary.select();
          if (!document.execCommand('copy')) throw new Error('Copy was unavailable.');
          temporary.remove();
        }
        if (shareStatus) shareStatus.textContent = 'Link copied. It includes both versions and the selected view.';
        if (button) {
          button.dataset.copied = 'true';
          button.setAttribute('aria-label', 'Link copied');
          button.setAttribute('title', 'Link copied');
        }
        root.setTimeout(() => {
          if (!button) return;
          delete button.dataset.copied;
          button.setAttribute('aria-label', 'Copy link to this view');
          button.setAttribute('title', 'Copy link to this view');
        }, 1600);
      } catch {
        if (shareStatus) shareStatus.textContent = 'Copy the URL from your browser address bar; it is already updated.';
      }
    }

    function reportApiError(error, retry) {
      setLoadingSurface(diffPage, '', false);
      if (currentComparison) results.hidden = false;
      else intro.hidden = false;
      setStatus(status, error.message || 'The comparison could not be loaded.', 'error');
      if (error.rateLimited || error.status === 401) {
        retryAfterTokenChange = retry;
        document.dispatchEvent(new root.CustomEvent('github-token-required', {
          detail: { message: error.message, resetAt: error.resetAt, invalid: error.status === 401 }
        }));
      }
    }

    const tabs = setupTabs(document, view => {
      currentView = view;
      syncViewUrl();
      navigator.refresh();
    });

    document.addEventListener('github-token-changed', event => {
      if (!retryAfterTokenChange || !event.detail?.hasToken) return;
      const retry = retryAfterTokenChange;
      retryAfterTokenChange = null;
      retry();
    });

    if (context.targetUrl) input.value = context.targetUrl;
    if (context.error) setStatus(status, context.error.message, 'error');

    function renderComparison(comparison) {
      currentComparison = comparison;
      const info = comparison.info;
      const parts = root.Diff.diffLines(comparison.before, comparison.after);
      const counts = countChangedLines(parts);
      const headRef = comparison.headCommit.sha;
      const baseRef = comparison.baseCommit?.sha || '';
      const isNewFile = !String(comparison.before || '').trim() && Boolean(String(comparison.after || '').trim());
      const title = extractTitle(comparison.after, info.path.split('/').pop().replace(/\.mdx?$/i, ''));

      document.title = `${title} — Microsoft Docs X-Ray`;
      setCanonical(document, info.publicUrl);
      const resultTitle = diffPage.querySelector('[data-result-title]');
      const resultSource = diffPage.querySelector('[data-result-source]');
      const resultStats = diffPage.querySelector('[data-result-stats]');
      const resultLearn = diffPage.querySelector('[data-result-learn]');
      const resultGithub = diffPage.querySelector('[data-result-github]');
      if (resultTitle) resultTitle.textContent = title;
      if (resultSource) resultSource.textContent = info.sourceLabel;
      if (resultStats) {
        resultStats.textContent = isNewFile
          ? `New page · +${counts.additions} lines added`
          : `+${counts.additions} / −${counts.deletions} lines ${comparisonDescription(comparison, currentHistory)}`;
      }
      if (resultLearn) resultLearn.href = info.publicUrl;
      if (resultLearn) {
        const siteLabel = info.siteLabel || 'Documentation';
        resultLearn.setAttribute('aria-label', `Open on ${siteLabel}`);
        resultLearn.setAttribute('title', `Open on ${siteLabel}`);
        const label = resultLearn.querySelector('span');
        if (label) label.textContent = siteLabel;
      }
      if (resultGithub) resultGithub.href = githubFileUrl(info, headRef);
      const explorer = diffPage.querySelector('[data-version-explorer]');
      if (explorer) {
        explorer.innerHTML = historyExplorer(currentHistory, comparison, historyHasMore);
        setHistorySelections(explorer, comparison);
      }
      const visualDiff = diffPage.querySelector('[data-visual-diff]');
      const markdownDiff = diffPage.querySelector('[data-markdown-diff]');
      if (visualDiff) visualDiff.innerHTML = renderVisualDiff(comparison.before, comparison.after, info, baseRef, headRef);
      if (markdownDiff) markdownDiff.innerHTML = renderMarkdownDiff(comparison.before, comparison.after, info, baseRef, headRef);
      const missingPage = diffPage.querySelector('[data-missing-source-page]');
      const hero = diffPage.querySelector('.diff-hero');
      if (missingPage) missingPage.hidden = true;
      if (hero) hero.hidden = false;
      document.body.classList.remove('missing-source-mode');
      intro.hidden = true;
      results.hidden = false;
      retryAfterTokenChange = null;
      setStatus(status, '', '');
      setLoadingSurface(diffPage, '', false);
      syncViewUrl();
      tabs.select(currentView, false);
      navigator.refresh();
      scrollPageToTop(root);
    }

    async function compareRefs(refs) {
      if (!currentInfo) return;
      const loadingStartedAt = Date.now();
      navigator.hide();
      setStatus(status, '', '');
      setLoadingSurface(diffPage, 'revisions');
      try {
        const comparison = await loadComparison(currentInfo, savedToken(), refs, currentHistory);
        setLoadingSurface(diffPage, 'rendering');
        await waitForMinimumLoading(loadingStartedAt);
        renderComparison(comparison);
      } catch (error) {
        reportApiError(error, () => compareRefs(refs));
      }
    }

    results.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || !currentComparison) return;
      if (button.matches('[data-share-view]')) {
        await copyViewUrl(button);
        return;
      }
      if (button.matches('[data-compare-latest]')) {
        if (currentHistory.length < 2) return;
        compareRefs({ base: currentHistory[1].sha, head: currentHistory[0].sha });
        return;
      }
      if (button.matches('[data-history-from]')) {
        if (currentHistory.length < 2) return;
        const selected = button.dataset.historyFrom;
        const refs = selected === currentHistory[0].sha
          ? { base: currentHistory[1].sha, head: currentHistory[0].sha }
          : { base: selected, head: currentHistory[0].sha };
        compareRefs(refs);
        return;
      }
      if (button.matches('[data-compare-selected]')) {
        const controls = button.closest('.advanced-comparison');
        const errorOutput = controls.querySelector('[data-comparison-error]');
        try {
          const refs = validateComparisonRefs(
            currentHistory,
            controls.querySelector('[data-comparison-base]').value,
            controls.querySelector('[data-comparison-head]').value
          );
          errorOutput.textContent = '';
          compareRefs(refs);
        } catch (error) { errorOutput.textContent = error.message; }
        return;
      }
      if (button.matches('[data-load-older]')) {
        button.disabled = true;
        button.textContent = 'Loading older versions…';
        try {
          const older = await loadHistory(currentInfo, savedToken(), historyPage + 1);
          historyPage += 1;
          const known = new Set(currentHistory.map(commit => commit.sha));
          currentHistory.push(...older.filter(commit => !known.has(commit.sha)));
          historyHasMore = older.length === HISTORY_PAGE_SIZE;
          const explorer = diffPage.querySelector('[data-version-explorer]');
          explorer.innerHTML = historyExplorer(currentHistory, currentComparison, historyHasMore);
          setHistorySelections(explorer, currentComparison);
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Load older versions';
          reportApiError(error, () => button.click());
        }
      }
    });

    async function loadArticle(value, requestedRefs) {
      const loadingStartedAt = Date.now();
      navigator.hide();
      submit.disabled = true;
      submit.textContent = 'Loading history…';
      setStatus(status, '', '');
      setLoadingSurface(diffPage, 'mapping');
      if (!currentComparison) {
        results.hidden = true;
        intro.hidden = true;
      }
      try {
        if (context.targetUrl && value !== context.targetUrl) {
          root.location.assign(diffUrlForLearnUrl(value, root.location.href));
          return;
        }
        currentInfo = await resolveSiteUrlToRepoInfo(value);
        setLoadingSurface(diffPage, 'history');
        historyPage = 1;
        currentHistory = await loadHistory(currentInfo, savedToken());
        if (!currentHistory.length && currentInfo.sourceResolution !== 'resolved') {
          const resolvedInfo = await resolveSiteUrlToRepoInfo(value, [], root.fetch);
          if (resolvedInfo.repository !== currentInfo.repository || resolvedInfo.path !== currentInfo.path || resolvedInfo.defaultBranch !== currentInfo.defaultBranch) {
            currentInfo = resolvedInfo;
            currentHistory = await loadHistory(currentInfo, savedToken());
          }
        }
        if (!currentHistory.length) {
          throw missingSourceHistoryError(currentInfo.path);
        }
        historyHasMore = currentHistory.length === HISTORY_PAGE_SIZE;
        setLoadingSurface(diffPage, 'revisions');
        const comparison = await loadComparison(currentInfo, savedToken(), requestedRefs, currentHistory);
        setLoadingSurface(diffPage, 'rendering');
        await waitForMinimumLoading(loadingStartedAt);
        renderComparison(comparison);
      } catch (error) {
        if (isMissingSourceHistoryError(error)) {
          showMissingSourcePage(document, error);
          return;
        }
        if (isUnsupportedDocumentationError(error)) {
          showUnsupportedPage(document);
          return;
        }
        intro.hidden = false;
        reportApiError(error, () => loadArticle(value, requestedRefs));
      } finally {
        submit.disabled = false;
        submit.textContent = 'Load diff';
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const requestedRefs = initialRequest ? context.refs : null;
      initialRequest = false;
      loadArticle(input.value.trim(), requestedRefs);
    });

    if (context.targetUrl) form.requestSubmit();
  }

  const api = {
    TOKEN_STORAGE_KEY,
    configuredSources,
    isUnsupportedDocumentationError,
    isMissingSourceHistoryError,
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
    historyExplorer,
    siteUrlToRepoInfo,
    microsoftDocsSourceToRepoInfo,
    resolveSiteUrlToRepoInfo,
    githubFileUrl,
    extractTitle,
    stripFrontMatter,
    countChangedLines,
    markdownForRendering,
    resolveContentUrl,
    sanitizeRenderedHtml,
    renderMarkdown,
    renderVisualDiff,
    renderMarkdownDiff,
    continuousVisualDiffGroups,
    continuousMarkdownDiffGroups,
    request,
    loadHistory,
    loadComparison,
    validateComparisonRefs,
    init
  };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
  return api;
}));

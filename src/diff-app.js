(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MicrosoftXDiff = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const TOKEN_STORAGE_KEY = 'microsoftx-github-token';
  const PRODUCTION_APEX = 'microsoftx.com';
  const PRODUCTION_SHORTCUT = 'learn.microsoftx.com';
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

  function isLocalHostname(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  }

  function resolveShortcutLocation(locationLike) {
    const href = typeof locationLike === 'string' ? locationLike : locationLike?.href;
    let pageUrl;
    try { pageUrl = new URL(href); } catch { throw new Error('The current page URL is invalid.'); }
    const hostname = pageUrl.hostname.toLowerCase();

    if (hostname === PRODUCTION_SHORTCUT) {
      if (pageUrl.pathname === '/' || !pageUrl.pathname.replaceAll('/', '')) {
        return { mode: 'landing', pageUrl: pageUrl.href, targetUrl: null, refs: null };
      }
      const target = new URL(`https://learn.microsoft.com${pageUrl.pathname}${pageUrl.search}${pageUrl.hash}`);
      const refs = revisionRefsFromSearchParams(target.searchParams);
      target.searchParams.delete('_mx_base');
      target.searchParams.delete('_mx_head');
      return { mode: 'diff', pageUrl: pageUrl.href, targetUrl: target.href, refs };
    }

    if (hostname === PRODUCTION_APEX || hostname === `www.${PRODUCTION_APEX}` || isLocalHostname(hostname)) {
      const queryTarget = pageUrl.searchParams.get('url');
      if (!queryTarget) return { mode: 'landing', pageUrl: pageUrl.href, targetUrl: null, refs: null };
      let target;
      try { target = new URL(queryTarget); } catch { throw new Error('The supplied documentation URL is invalid.'); }
      const refs = revisionRefsFromSearchParams(pageUrl.searchParams);
      return { mode: 'diff', pageUrl: pageUrl.href, targetUrl: target.href, refs };
    }

    return { mode: 'unsupported-host', pageUrl: pageUrl.href, targetUrl: null, refs: null };
  }

  function shortcutUrlForLearnUrl(value) {
    let input;
    try { input = new URL(String(value || '').trim()); } catch {
      throw new Error('Enter a complete Microsoft Learn URL, including https://.');
    }
    if (input.protocol !== 'https:' || input.hostname.toLowerCase() !== 'learn.microsoft.com') {
      throw new Error('Use an https://learn.microsoft.com article URL.');
    }
    return `https://${PRODUCTION_SHORTCUT}${input.pathname}${input.search}${input.hash}`;
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
      throw new Error('Enter a complete Microsoft Learn URL, including https://.');
    }
    if (url.protocol !== 'https:') throw new Error('Documentation URLs must use https://.');
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

    if (!match) throw new Error(`This Microsoft Learn path is not supported yet: ${url.pathname}`);
    const { source, site, repository, articleSegments } = match;
    const finalIndex = articleSegments.length - 1;
    articleSegments[finalIndex] = articleSegments[finalIndex].replace(/\.(?:mdx?|html?)$/i, '');
    if (!articleSegments[finalIndex]) throw new Error('Use a documentation article URL, not a section landing page.');

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
      publicUrl: url.href,
      siteRoot: site.href.endsWith('/') ? site.href : `${site.href}/`,
      owner,
      repo,
      repository: `${owner}/${repo}`,
      defaultBranch,
      path,
      apiRoot: `https://api.github.com/repos/${owner}/${repo}`,
      githubRoot,
      githubUrl: `${githubRoot}/blob/${encodeURIComponent(defaultBranch)}/${path}`,
      historyUrl: `${githubRoot}/commits/${encodeURIComponent(defaultBranch)}/${path}`
    };
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
      try { return new URL(candidate.slice(2).replace(/\.md(?=($|[?#]))/i, ''), info.siteRoot).href; } catch { return ''; }
    }
    if (candidate.startsWith('/')) {
      try { return new URL(candidate.replace(/\.md(?=($|[?#]))/i, ''), 'https://learn.microsoft.com').href; } catch { return ''; }
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
      return new URL(candidate.replace(/\.md(?=($|[?#]))/i, ''), publicBase).href;
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
    return html.trim() ? `<div class="rich-diff">${html}</div>` : '<p class="quiet">No rendered content changed.</p>';
  }

  function renderMarkdownDiff(before, after, info, baseRef, headRef) {
    if (!root.Diff?.createTwoFilesPatch) throw new Error('The Markdown diff engine did not load.');
    const patch = root.Diff.createTwoFilesPatch(
      `${info.path} @ ${(baseRef || 'new file').slice(0, 7)}`,
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
    return `<div class="markdown-diff" role="region" aria-label="Markdown Git diff"><pre><code>${lines}</code></pre></div>`;
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

  async function loadComparison(info, token, refs) {
    const encodedPath = apiPath(info.path);
    const rawUrl = ref => `${info.apiRoot}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
    const rawAt = ref => request(rawUrl(ref), token, 'application/vnd.github.raw+json')
      .catch(error => error.status === 404 ? '' : Promise.reject(error));

    if (refs) {
      const commitUrl = ref => `${info.apiRoot}/commits/${encodeURIComponent(ref)}`;
      const headCommit = await request(commitUrl(refs.head), token);
      const baseRef = refs.base || headCommit.parents?.[0]?.sha || '';
      if (!baseRef) throw new Error('The selected after revision does not have a parent to compare.');
      const [baseCommit, before, after] = await Promise.all([
        request(commitUrl(baseRef), token),
        rawAt(baseRef),
        rawAt(refs.head)
      ]);
      return { info, headCommit, baseCommit, after, before };
    }

    const commits = await request(`${info.apiRoot}/commits?path=${encodedPath}&per_page=2`, token);
    if (!Array.isArray(commits) || !commits.length) {
      throw new Error(`No file history was found at ${info.path}. The Learn page may use a nonstandard source path.`);
    }
    const headCommit = commits[0];
    const baseCommit = commits[1] || null;
    const [after, before] = await Promise.all([
      rawAt(headCommit.sha),
      baseCommit ? rawAt(baseCommit.sha) : Promise.resolve('')
    ]);
    return { info, headCommit, baseCommit, after, before };
  }

  function setStatus(element, message, state = '') {
    if (!element) return;
    element.hidden = !message;
    element.className = `compare-status ${state}`.trim();
    element.textContent = message || '';
  }

  function commitCard(commit, label) {
    if (!commit) return `<section class="revision-card"><span class="eyebrow">${label}</span><strong>New file</strong><p>No earlier revision was found.</p></section>`;
    const author = commit.commit?.author || {};
    return `<section class="revision-card"><span class="eyebrow">${label}</span><a href="${escapeHtml(commit.html_url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(commit.sha.slice(0, 7))}</strong></a><p>${escapeHtml(firstLine(commit.commit?.message))}</p>${author.date ? `<time datetime="${escapeHtml(author.date)}">${escapeHtml(formatDate(author.date))}</time>` : ''}</section>`;
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
    buttons.forEach(button => button.addEventListener('click', () => {
      buttons.forEach(item => {
        const selected = item === button;
        item.classList.toggle('active', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      document.querySelectorAll('[data-diff-panel]').forEach(panel => {
        panel.hidden = panel.dataset.diffPanel !== button.dataset.diffTab;
      });
      onChange?.();
    }));
  }

  function createDiffNavigator(document) {
    const nav = document.querySelector('[data-diff-navigator]');
    const diffRoot = document.querySelector('[data-diff-content]');
    if (!nav || !diffRoot) return { refresh() {}, hide() {} };
    const label = nav.querySelector('[data-diff-position]');
    const previous = nav.querySelector('[data-diff-previous]');
    const next = nav.querySelector('[data-diff-next]');
    let targets = [];
    let index = -1;

    function refresh() {
      diffRoot.querySelectorAll('.diff-jump-target,.diff-jump-active').forEach(node => node.classList.remove('diff-jump-target', 'diff-jump-active'));
      index = -1;
      const panel = diffRoot.querySelector('[data-diff-panel]:not([hidden])');
      if (!panel) return hide();
      targets = panel.dataset.diffPanel === 'markdown'
        ? [...panel.querySelectorAll('.markdown-diff-line.hunk')]
        : [...new Set([...panel.querySelectorAll('ins,del')].map(node => node.closest('p,li,h1,h2,h3,h4,h5,h6,tr,pre,blockquote') || node))];
      if (!targets.length && panel.dataset.diffPanel === 'markdown') {
        targets = [...panel.querySelectorAll('.markdown-diff-line.added,.markdown-diff-line.removed')];
      }
      targets.forEach(target => target.classList.add('diff-jump-target'));
      nav.hidden = !targets.length;
      label.textContent = `${targets.length} change${targets.length === 1 ? '' : 's'}`;
    }

    function hide() {
      targets = [];
      index = -1;
      nav.hidden = true;
    }

    function move(amount) {
      if (!targets.length) return;
      index = index < 0 ? (amount > 0 ? 0 : targets.length - 1) : (index + amount + targets.length) % targets.length;
      targets.forEach((target, targetIndex) => target.classList.toggle('diff-jump-active', targetIndex === index));
      label.textContent = `${index + 1} of ${targets.length}`;
      targets[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    return { refresh, hide };
  }

  function setupTokenDialog(document, onTokenSaved) {
    const dialog = document.querySelector('[data-token-dialog]');
    const input = dialog?.querySelector('[data-token-input]');
    const status = dialog?.querySelector('[data-token-status]');
    function savedToken() {
      try { return root.localStorage.getItem(TOKEN_STORAGE_KEY) || ''; } catch { return ''; }
    }
    function open() {
      if (!dialog) return;
      input.value = savedToken();
      if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.hidden = false;
      input.focus();
    }
    document.querySelectorAll('[data-token-open]').forEach(button => button.addEventListener('click', open));
    dialog?.querySelector('[data-token-close]')?.addEventListener('click', () => dialog.close?.());
    dialog?.querySelector('[data-token-save]')?.addEventListener('click', () => {
      const token = input.value.trim();
      try {
        if (token) root.localStorage.setItem(TOKEN_STORAGE_KEY, token);
        else root.localStorage.removeItem(TOKEN_STORAGE_KEY);
        status.textContent = token ? 'Token saved in this browser.' : 'No token was saved.';
        onTokenSaved?.(token);
      } catch { status.textContent = 'This browser blocked local storage.'; }
    });
    dialog?.querySelector('[data-token-remove]')?.addEventListener('click', () => {
      try { root.localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
      input.value = '';
      status.textContent = 'Saved token removed.';
    });
    return { savedToken, open };
  }

  function init() {
    const document = root.document;
    if (!document) return;
    let context;
    try { context = resolveShortcutLocation(root.location.href); } catch (error) {
      context = { mode: 'error', error, targetUrl: null, refs: null };
    }

    const homeForm = document.querySelector('[data-home-url-form]');
    const homeStatus = document.querySelector('[data-home-url-status]');
    homeForm?.addEventListener('submit', event => {
      event.preventDefault();
      try {
        const shortcut = shortcutUrlForLearnUrl(homeForm.elements.url.value);
        root.location.assign(shortcut);
      } catch (error) { setStatus(homeStatus, error.message, 'error'); }
    });

    if (root.location.hostname === PRODUCTION_APEX && root.location.pathname !== '/') {
      root.history.replaceState(null, '', `/${root.location.search}${root.location.hash}`);
    }
    if (root.location.hostname === PRODUCTION_SHORTCUT) addNoIndex(document);
    const tokenUi = setupTokenDialog(document, () => {
      const retryActions = document.querySelector('[data-rate-actions]');
      const retryForm = document.querySelector('[data-diff-form]');
      if (retryForm && retryActions && !retryActions.hidden) retryForm.requestSubmit();
    });
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
    const rateActions = diffPage.querySelector('[data-rate-actions]');
    const navigator = createDiffNavigator(document);
    setupTabs(document, navigator.refresh);

    if (context.targetUrl) input.value = context.targetUrl;
    if (context.error) setStatus(status, context.error.message, 'error');

    form.addEventListener('submit', async event => {
      event.preventDefault();
      rateActions.hidden = true;
      results.hidden = true;
      navigator.hide();
      submit.disabled = true;
      submit.textContent = 'Comparing…';
      setStatus(status, 'Finding the source file and its latest revisions on GitHub…', 'loading');
      try {
        const value = input.value.trim();
        if (root.location.hostname === PRODUCTION_SHORTCUT && context.targetUrl && value !== context.targetUrl) {
          root.location.assign(shortcutUrlForLearnUrl(value));
          return;
        }
        const info = siteUrlToRepoInfo(value);
        const comparison = await loadComparison(info, tokenUi.savedToken(), context.refs);
        const parts = root.Diff.diffLines(comparison.before, comparison.after);
        const counts = countChangedLines(parts);
        const headRef = comparison.headCommit.sha;
        const baseRef = comparison.baseCommit?.sha || '';
        const title = extractTitle(comparison.after, info.path.split('/').pop().replace(/\.md$/i, ''));

        document.title = `${title} — MicrosoftX diff`;
        setCanonical(document, info.publicUrl);
        diffPage.querySelector('[data-result-title]').textContent = title;
        diffPage.querySelector('[data-result-source]').textContent = info.sourceLabel;
        diffPage.querySelector('[data-result-path]').textContent = info.path;
        diffPage.querySelector('[data-result-stats]').textContent = `+${counts.additions} / −${counts.deletions} lines in the latest change`;
        const learnLink = diffPage.querySelector('[data-result-learn]');
        learnLink.href = info.publicUrl;
        const githubLink = diffPage.querySelector('[data-result-github]');
        githubLink.href = githubFileUrl(info, headRef);
        const historyLink = diffPage.querySelector('[data-result-history]');
        historyLink.href = info.historyUrl;
        diffPage.querySelector('[data-result-revisions]').innerHTML = commitCard(comparison.baseCommit, 'Before') + commitCard(comparison.headCommit, 'After');
        diffPage.querySelector('[data-visual-diff]').innerHTML = renderVisualDiff(comparison.before, comparison.after, info, baseRef, headRef);
        diffPage.querySelector('[data-markdown-diff]').innerHTML = renderMarkdownDiff(comparison.before, comparison.after, info, baseRef, headRef);
        intro.hidden = true;
        results.hidden = false;
        setStatus(status, '', '');
        navigator.refresh();
      } catch (error) {
        intro.hidden = false;
        setStatus(status, error.message || 'The comparison could not be loaded.', 'error');
        if (error.rateLimited || error.status === 401) rateActions.hidden = false;
      } finally {
        submit.disabled = false;
        submit.textContent = 'Compare latest change';
      }
    });

    if (context.targetUrl) form.requestSubmit();
  }

  const api = {
    TOKEN_STORAGE_KEY,
    configuredSources,
    revisionRefsFromSearchParams,
    resolveShortcutLocation,
    shortcutUrlForLearnUrl,
    siteUrlToRepoInfo,
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
    request,
    loadComparison,
    init
  };

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
  return api;
}));

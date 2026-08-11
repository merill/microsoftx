const MAX_LEARN_URL_LENGTH = 4096;
const MAX_LEARN_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export class LearnSourceError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'LearnSourceError';
    this.status = status;
  }
}

export function normalizeLearnUrl(value) {
  const input = String(value || '').trim();
  if (!input || input.length > MAX_LEARN_URL_LENGTH) {
    throw new LearnSourceError('Enter a valid Microsoft Learn article URL.', 400);
  }

  let url;
  try { url = new URL(input); } catch {
    throw new LearnSourceError('Enter a complete Microsoft Learn URL, including https://.', 400);
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname.toLowerCase() !== 'learn.microsoft.com' ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new LearnSourceError('Only https://learn.microsoft.com article URLs are supported.', 400);
  }
  url.hash = '';
  return url;
}

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function attributesFromTag(tag) {
  const attributes = {};
  const pattern = /\b([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (name === 'meta') continue;
    attributes[name] = decodeHtmlAttribute(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

export function publicGitHubSourceFromHtml(html) {
  for (const tag of String(html || '').match(/<meta\b[^>]*>/gi) || []) {
    const attributes = attributesFromTag(tag);
    if (attributes.name?.toLowerCase() === 'github_feedback_content_git_url' && attributes.content) {
      return attributes.content;
    }
  }
  throw new LearnSourceError('This Microsoft Learn page does not expose a public GitHub source.', 404);
}

function safePathSegment(value, label) {
  let decoded;
  try { decoded = decodeURIComponent(value); } catch {
    throw new LearnSourceError(`The GitHub ${label} contains invalid path encoding.`, 404);
  }
  if (!decoded || decoded === '.' || decoded === '..' || /[\\/\0]/.test(decoded)) {
    throw new LearnSourceError(`The GitHub ${label} is invalid.`, 404);
  }
  return decoded;
}

export function microsoftDocsSourceInfo(sourceValue) {
  let source;
  try { source = new URL(String(sourceValue || '').trim()); } catch {
    throw new LearnSourceError('Microsoft Learn returned an invalid public source URL.', 404);
  }
  if (
    source.protocol !== 'https:' ||
    source.hostname.toLowerCase() !== 'github.com' ||
    source.port ||
    source.username ||
    source.password ||
    source.search ||
    source.hash
  ) {
    throw new LearnSourceError('Microsoft Learn returned an unsupported public source URL.', 404);
  }

  const segments = source.pathname.split('/').filter(Boolean);
  if (segments.length < 5 || segments[2].toLowerCase() !== 'blob') {
    throw new LearnSourceError('Microsoft Learn returned an unsupported public source URL.', 404);
  }
  const owner = safePathSegment(segments[0], 'repository owner');
  const repo = safePathSegment(segments[1], 'repository name');
  const branch = safePathSegment(segments[3], 'branch');
  const path = segments.slice(4).map(segment => safePathSegment(segment, 'source path')).join('/');
  if (owner.toLowerCase() !== 'microsoftdocs' || !/^[a-z0-9._-]+$/i.test(repo)) {
    throw new LearnSourceError('The public source is not in the MicrosoftDocs organization.', 404);
  }
  if (!/\.(?:mdx?|markdown|ya?ml)$/i.test(path)) {
    throw new LearnSourceError('The public source is not a supported documentation file.', 404);
  }

  return {
    sourceUrl: source.href,
    owner,
    repo,
    branch,
    path
  };
}

function redirectStatus(status) {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

export async function resolveLearnSource(value, fetchImpl = globalThis.fetch, signal) {
  if (typeof fetchImpl !== 'function') throw new LearnSourceError('Microsoft Learn lookup is unavailable.');
  const requestedUrl = normalizeLearnUrl(value);
  let currentUrl = requestedUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let response;
    try {
      response = await fetchImpl(currentUrl, {
        method: 'GET',
        headers: { accept: 'text/html; charset=utf-8' },
        redirect: 'manual',
        signal
      });
    } catch (error) {
      if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        throw new LearnSourceError('Microsoft Learn source lookup timed out.', 504);
      }
      throw new LearnSourceError('Microsoft Learn source lookup failed.');
    }

    if (redirectStatus(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new LearnSourceError('Microsoft Learn returned too many redirects.');
      }
      currentUrl = normalizeLearnUrl(new URL(location, currentUrl).href);
      continue;
    }
    if (response.status === 404) throw new LearnSourceError('This Microsoft Learn page was not found.', 404);
    if (!response.ok) throw new LearnSourceError(`Microsoft Learn source lookup failed with HTTP ${response.status}.`);

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) {
      throw new LearnSourceError('Microsoft Learn returned an unexpected response.');
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_LEARN_HTML_BYTES) {
      throw new LearnSourceError('The Microsoft Learn page is too large to inspect.', 413);
    }
    const html = await response.text();
    if (new TextEncoder().encode(html).byteLength > MAX_LEARN_HTML_BYTES) {
      throw new LearnSourceError('The Microsoft Learn page is too large to inspect.', 413);
    }
    const source = microsoftDocsSourceInfo(publicGitHubSourceFromHtml(html));
    return {
      requestedUrl: requestedUrl.href,
      resolvedUrl: currentUrl.href,
      ...source
    };
  }

  throw new LearnSourceError('Microsoft Learn source lookup failed.');
}

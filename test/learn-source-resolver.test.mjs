import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LearnSourceError,
  microsoftDocsSourceInfo,
  normalizeLearnUrl,
  publicGitHubSourceFromHtml,
  resolveLearnSource
} from '../src/learn-source-resolver.mjs';

test('Learn source metadata is extracted regardless of attribute order and decoded safely', () => {
  const html = `<!doctype html><meta content="https://github.com/MicrosoftDocs/example-docs/blob/main/docs/a&amp;b.md" data-test="source" name="github_feedback_content_git_url">`;
  assert.equal(
    publicGitHubSourceFromHtml(html),
    'https://github.com/MicrosoftDocs/example-docs/blob/main/docs/a&b.md'
  );
});

test('MicrosoftDocs source URLs expose a validated repository, branch, and path', () => {
  assert.deepEqual(
    microsoftDocsSourceInfo('https://github.com/MicrosoftDocs/defender-docs/blob/public/defender-endpoint/overview.md'),
    {
      sourceUrl: 'https://github.com/MicrosoftDocs/defender-docs/blob/public/defender-endpoint/overview.md',
      owner: 'MicrosoftDocs',
      repo: 'defender-docs',
      branch: 'public',
      path: 'defender-endpoint/overview.md'
    }
  );
  assert.throws(
    () => microsoftDocsSourceInfo('https://github.com/other/docs/blob/main/article.md'),
    error => error instanceof LearnSourceError && error.status === 404
  );
  assert.throws(
    () => microsoftDocsSourceInfo('https://github.com/MicrosoftDocs/docs/blob/main/script.js'),
    /supported documentation file/
  );
});

test('Learn URL validation blocks non-Learn hosts, credentials, ports, and fragments', () => {
  assert.equal(
    normalizeLearnUrl('https://learn.microsoft.com/en-us/example?view=test#heading').href,
    'https://learn.microsoft.com/en-us/example?view=test'
  );
  for (const value of [
    'http://learn.microsoft.com/example',
    'https://example.com/example',
    'https://user@learn.microsoft.com/example',
    'https://learn.microsoft.com:444/example'
  ]) {
    assert.throws(() => normalizeLearnUrl(value), error => error instanceof LearnSourceError && error.status === 400);
  }
});

test('source resolution follows only Learn redirects and returns the exact public GitHub source', async () => {
  const calls = [];
  const fetcher = async url => {
    calls.push(String(url));
    if (calls.length === 1) {
      return new Response('', {
        status: 302,
        headers: { location: '/en-us/unified-secops/overview', 'content-type': 'text/html' }
      });
    }
    return new Response(`<!doctype html><meta name="github_feedback_content_git_url" content="https://github.com/MicrosoftDocs/defender-docs/blob/public/unified-secops-platform/overview.md">`, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
  };
  const result = await resolveLearnSource('https://learn.microsoft.com/en-us/unified-secops-platform/overview', fetcher);
  assert.equal(calls.length, 2);
  assert.equal(result.resolvedUrl, 'https://learn.microsoft.com/en-us/unified-secops/overview');
  assert.equal(result.repo, 'defender-docs');
  assert.equal(result.path, 'unified-secops-platform/overview.md');
});

test('source resolution rejects cross-origin redirects and pages without public GitHub metadata', async () => {
  await assert.rejects(
    () => resolveLearnSource('https://learn.microsoft.com/example', async () => new Response('', {
      status: 302,
      headers: { location: 'https://example.com/private' }
    })),
    error => error instanceof LearnSourceError && error.status === 400
  );
  await assert.rejects(
    () => resolveLearnSource('https://learn.microsoft.com/example', async () => new Response('<html></html>', {
      status: 200,
      headers: { 'content-type': 'text/html' }
    })),
    error => error instanceof LearnSourceError && error.status === 404
  );
});

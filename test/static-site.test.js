const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function read(relativePath) {
  return fs.readFileSync(path.join(dist, relativePath), 'utf8');
}

test('build emits static SEO pages and intentionally omits a 404 page', () => {
  for (const file of ['index.html', 'about/index.html', 'supported/index.html', 'privacy/index.html', 'robots.txt', 'sitemap.xml', '_headers']) {
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
    assert.equal(document.querySelectorAll('#main-content').length, 1, file);
    assert.equal(document.querySelector('.independent-bar').textContent.includes('not affiliated with Microsoft'), true);
    titles.add(document.title);
  }
  assert.equal(titles.size, pages.length);
});

test('home page contains crawlable software and FAQ structured data plus the diff shell', () => {
  const html = read('index.html');
  assert.match(html, /schema\.org\/SoftwareApplication/);
  assert.match(html, /schema\.org\/FAQPage/);
  assert.match(html, /Add an <span class="x-accent">x<\/span>/);
  assert.match(html, /data-diff-page hidden/);
  assert.match(html, /data-rate-actions hidden/);
  assert.doesNotMatch(html, /requests remaining|of 60|data-github-rate/i);
});

test('About, Supported, and Privacy pages contain the promised durable content', () => {
  assert.match(read('about/index.html'), /Why it exists/);
  assert.match(read('about/index.html'), /Built by Merill/);
  assert.match(read('supported/index.html'), /MicrosoftDocs\/entra-docs/);
  assert.match(read('supported/index.html'), /graph-rest-beta/);
  assert.match(read('privacy/index.html'), /api\.github\.com/);
  assert.match(read('privacy/index.html'), /localStorage/);
});

test('sitemap contains only apex static pages and robots points to it', () => {
  const sitemap = read('sitemap.xml');
  for (const route of ['/', '/about/', '/supported/', '/privacy/']) {
    assert.match(sitemap, new RegExp(`<loc>https://microsoftx\\.com${route.replaceAll('/', '\\/')}</loc>`));
  }
  assert.doesNotMatch(sitemap, /learn\.microsoftx\.com/);
  assert.match(read('robots.txt'), /Sitemap: https:\/\/microsoftx\.com\/sitemap\.xml/);
});

test('Pages headers enforce the browser-only security boundary', () => {
  const headers = read('_headers');
  assert.match(headers, /connect-src 'self' https:\/\/api\.github\.com/);
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval/);
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

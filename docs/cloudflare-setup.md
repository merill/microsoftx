# Cloudflare setup and launch checklist

The application itself is fully static. Cloudflare account settings are intentionally kept outside the repository because they belong to the primary and alternative domain zones.

The zone is already delegated to Cloudflare nameservers. No production DNS records were present when the project was created.

## 1. Certificate gate

Do this before promoting or announcing the site.

1. Deploy the Pages project to its temporary `*.pages.dev` hostname.
2. In **Workers & Pages → MicrosoftX → Custom domains**, add `microsoftx.com`.
3. Add `learn.microsoftx.com` as a second exact custom domain.
4. If an availability mirror is being launched, add its apex as another exact custom domain on the same Pages project.
5. Wait for every domain to report **Active** with valid HTTPS certificates.

Cloudflare warns that Universal SSL can decline domains containing words that conflict with trademarked domains. Do not launch over HTTP or bypass a certificate warning. If either exact domain cannot receive a certificate, stop and resolve the domain/certificate issue before adding wildcard routing.

## 2. Pages project

Connect `merill/microsoftx` through the Cloudflare Pages Git integration.

| Setting | Value |
| --- | --- |
| Project type | Pages |
| Production branch | `main` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | repository root |
| Node.js | 20 or later |

Do not add a Pages Function, `_worker.js`, or Worker route. Pages should serve only the files produced in `dist/`.

The project deliberately has no `404.html`. Pages therefore serves the root `index.html` for an unmatched navigation such as:

```text
https://learn.microsoftx.com/en-us/entra/identity/authentication/concept-sms-voice-retirement
```

The browser detects any non-reserved path and switches that document into diff mode. This works on `learn.microsoftx.com`, `microsoftx.com`, the Pages development hostname, localhost, and configured alternative domains. The reserved site routes are `/`, `/about/`, `/supported/`, and `/privacy/`.

The same artifact is used on every hostname. First-party navigation and assets are root-relative. `CANONICAL_ORIGIN` controls only absolute SEO output and defaults to `https://microsoftx.com`; do not change it for a non-indexed mirror.

## 3. Alternative-domain mirror

Use one alternative apex hostname, represented below as `alternative.example`.

1. Add `alternative.example` under the existing Pages project's **Custom domains**.
2. Complete any DNS ownership steps shown by Pages and wait for the domain and certificate to become **Active**.
3. Do not redirect the alternative hostname to `microsoftx.com`.
4. Do not create a separate Pages project, build, Worker, or Pages Function.

The alternative hostname serves both the marketing site and portable diff URLs:

```text
https://alternative.example/
https://alternative.example/about/
https://alternative.example/en-us/entra/identity/authentication/concept-sms-voice-retirement
```

A blocked primary domain cannot automatically redirect a browser because none of its code can load. Publish the alternative hostname through a separate trusted channel and encourage users who need it to bookmark it.

## 4. Exact and wildcard DNS

Adding the two Pages custom domains should create exact Cloudflare-managed DNS records for:

- `microsoftx.com`
- `learn.microsoftx.com`

After both are active, add one wildcard DNS record for all other first-level subdomains:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `*` | `microsoftx.com` | Proxied |

The exact `learn.microsoftx.com` record takes precedence over `*`, so the Learn shortcut continues to be served directly by Pages and remains visible in the address bar.

## 5. Redirect other subdomains

Create a **Rules → Redirect Rules → Single Redirect** rule.

Name:

```text
Redirect unknown MicrosoftX subdomains to apex
```

Match expression:

```text
ends_with(http.host, ".microsoftx.com") and http.host ne "learn.microsoftx.com"
```

Action:

| Setting | Value |
| --- | --- |
| Target URL | `https://microsoftx.com/` |
| Status | `302` during validation |
| Preserve query string | Off |

This catches `www.microsoftx.com` and arbitrary subdomains without changing `learn.microsoftx.com`. After production checks pass and the behavior is considered permanent, change the status to `301`.

## 6. Exclude mirrors and diff URLs from indexing

Create a **Rules → Transform Rules → Modify Response Header** rule.

Name:

```text
Noindex MicrosoftX diff host
```

Match expression:

```text
http.host eq "learn.microsoftx.com"
```

Set response header:

| Header | Value |
| --- | --- |
| `X-Robots-Tag` | `noindex, nofollow` |

The client also inserts a matching robots meta element on every runtime diff route, regardless of hostname, but the edge response header is the authoritative signal for the dedicated Learn host.

Do not apply this header to `microsoftx.com`; the Home, About, Supported, and Privacy pages are intended to be indexed.

Create a second **Modify Response Header** rule in the alternative domain's zone. Match the exact alternative hostname:

```text
http.host eq "alternative.example"
```

Set `X-Robots-Tag` to `noindex, nofollow` for every response. The alternative is an availability mirror, while canonical tags, Open Graph metadata, structured data, `robots.txt`, and `sitemap.xml` continue pointing to the primary `microsoftx.com` origin.

## 7. HTTPS and security

- Turn on **Always Use HTTPS** for the zone after both certificates are active.
- Leave the Pages-generated `_headers` file enabled. It restricts scripts to same-origin assets and browser API connections to `api.github.com`.
- Do not add broad CSP exceptions such as `unsafe-inline` or `unsafe-eval`.
- Do not put a shared GitHub token in Pages environment variables. The static application has no legitimate use for one.
- Optional GitHub tokens are scoped by the browser to the exact origin. A user who switches to the alternative domain must add the token again there.

## 8. Production verification

Run these checks after the first custom-domain deployment.

```bash
curl -I https://microsoftx.com/
curl -I https://microsoftx.com/about/
curl -I https://learn.microsoftx.com/en-us/entra/identity/authentication/concept-sms-voice-retirement
curl -I https://www.microsoftx.com/test?discard=me
curl -I https://alternative.example/
curl -I https://alternative.example/about/
curl -I https://alternative.example/en-us/entra/identity/authentication/concept-sms-voice-retirement
```

Expected results:

- Apex and static content pages return `200` with valid certificates.
- The Learn deep link returns the SPA document, stays on `learn.microsoftx.com`, and includes `X-Robots-Tag: noindex, nofollow`.
- `www` and other subdomains return a `302` to exactly `https://microsoftx.com/` without the original path or query.
- The alternative homepage and static pages return `200`, remain on the alternative hostname, and load all first-party scripts, styles, images, and navigation from that same origin.
- The alternative deep path remains in the address bar, loads the same Entra comparison, and returns `X-Robots-Tag: noindex, nofollow`.
- The browser loads the example diff and links to `MicrosoftDocs/entra-docs` at `docs/identity/authentication/concept-sms-voice-retirement.md`.
- `https://microsoftx.com/sitemap.xml` lists only the four apex static pages.
- Browser developer tools show GitHub data requests going directly to `api.github.com`; no comparison data is posted to Microsoft Docs X-Ray.

After these checks, change the wildcard redirect from `302` to `301` and submit the apex sitemap to the desired search-engine webmaster tools.

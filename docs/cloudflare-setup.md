# Cloudflare setup and launch checklist

The application itself is fully static. Cloudflare account settings are intentionally kept outside the repository because they belong to the `microsoftx.com` zone.

The zone is already delegated to Cloudflare nameservers. No production DNS records were present when the project was created.

## 1. Certificate gate

Do this before promoting or announcing the site.

1. Deploy the Pages project to its temporary `*.pages.dev` hostname.
2. In **Workers & Pages → MicrosoftX → Custom domains**, add `microsoftx.com`.
3. Add `learn.microsoftx.com` as a second exact custom domain.
4. Wait for both domains to report **Active** with valid HTTPS certificates.

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

The browser detects the `learn.microsoftx.com` hostname and switches that document into diff mode.

## 3. Exact and wildcard DNS

Adding the two Pages custom domains should create exact Cloudflare-managed DNS records for:

- `microsoftx.com`
- `learn.microsoftx.com`

After both are active, add one wildcard DNS record for all other first-level subdomains:

| Type | Name | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `*` | `microsoftx.com` | Proxied |

The exact `learn.microsoftx.com` record takes precedence over `*`, so the Learn shortcut continues to be served directly by Pages and remains visible in the address bar.

## 4. Redirect other subdomains

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

## 5. Exclude diff URLs from indexing

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

The client also inserts a matching robots meta element on the Learn hostname, but the edge response header is the authoritative crawler signal.

Do not apply this header to `microsoftx.com`; the Home, About, Supported, and Privacy pages are intended to be indexed.

## 6. HTTPS and security

- Turn on **Always Use HTTPS** for the zone after both certificates are active.
- Leave the Pages-generated `_headers` file enabled. It restricts scripts to same-origin assets and browser API connections to `api.github.com`.
- Do not add broad CSP exceptions such as `unsafe-inline` or `unsafe-eval`.
- Do not put a shared GitHub token in Pages environment variables. The static application has no legitimate use for one.

## 7. Production verification

Run these checks after the first custom-domain deployment.

```bash
curl -I https://microsoftx.com/
curl -I https://microsoftx.com/about/
curl -I https://learn.microsoftx.com/en-us/entra/identity/authentication/concept-sms-voice-retirement
curl -I https://www.microsoftx.com/test?discard=me
```

Expected results:

- Apex and static content pages return `200` with valid certificates.
- The Learn deep link returns the SPA document, stays on `learn.microsoftx.com`, and includes `X-Robots-Tag: noindex, nofollow`.
- `www` and other subdomains return a `302` to exactly `https://microsoftx.com/` without the original path or query.
- The browser loads the example diff and links to `MicrosoftDocs/entra-docs` at `docs/identity/authentication/concept-sms-voice-retirement.md`.
- `https://microsoftx.com/sitemap.xml` lists only the four apex static pages.
- Browser developer tools show GitHub data requests going directly to `api.github.com`; no comparison data is posted to Microsoft Docs X-Ray.

After these checks, change the wildcard redirect from `302` to `301` and submit the apex sitemap to the desired search-engine webmaster tools.

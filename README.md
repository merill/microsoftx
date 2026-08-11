# Microsoft Docs X-Ray

<p align="center">
  <img src="assets/branding/microsoftx-logo.png" alt="Microsoft Docs X-Ray logo" width="200">
</p>

Microsoft Docs X-Ray gives users X-ray vision into Microsoft Learn documentation changes. It is a browser-based page-diff viewer with a narrowly scoped source-lookup edge function. Change a supported URL from:

```text
https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview
```

to:

```text
https://learn.microsoftx.com/en-us/entra/identity/conditional-access/overview
```

Reviewed routes map directly to a public GitHub repository, including current Aspire articles on `aspire.dev`. Other Learn articles use a same-origin source lookup that accepts only `learn.microsoft.com` URLs and public `MicrosoftDocs/*` source links. The browser then loads the file history and renders visual and Markdown views locally. The default is still the latest change; the timeline can compare any earlier version with the current page, and an advanced picker can compare any two loaded versions.

Microsoft Docs X-Ray is an independent community project and is not affiliated with Microsoft.

## Architecture

- `microsoftx.com` serves indexed static Home, About, Supported, and Privacy pages.
- `learn.microsoftx.com` keeps the one-letter shortcut. Any additional HTTPS custom domain can serve both the static site and portable diff paths such as `https://alternative.example/en-us/entra/...` from the same build.
- Unknown paths receive the root SPA document, which reconstructs the corresponding `learn.microsoft.com` URL and loads the diff. First-party navigation and assets are root-relative, so no runtime resource depends on `microsoftx.com` being reachable.
- Other `*.microsoftx.com` hostnames are redirected to the apex by a Cloudflare zone rule.
- A Cloudflare Pages Function requests Microsoft Learn only to resolve a page's published public GitHub source. It returns the repository, branch, and path and does not receive GitHub history, revisions, diffs, or tokens.
- The browser contacts `api.github.com` for comparison data. Relative documentation images can load from `raw.githubusercontent.com`.
- The UserJot feedback widget loads from `cdn.userjot.com` and sends widget requests to `widget.userjot.com` using the public project ID `cmsjwvw5q3wdt0ipd5tpvg5y5`.
- There is no application server, database, account system, or shared GitHub token.

The reviewed source list in [`src/diff-config.js`](src/diff-config.js) covers Microsoft Defender (including the public `defender-docs` docsets), Microsoft Entra, Azure, Microsoft Graph, .NET, Aspire, PowerShell, Microsoft 365, Intune, Fabric, Dynamics 365, Power Apps, SQL, Visual Studio, ASP.NET Core, and Windows Server. Aspire maps `aspire.dev` MDX pages to `microsoft/aspire.dev`; legacy `/dotnet/aspire/` Learn links remain supported. Microsoft Learn articles backed by other public repositories in the [MicrosoftDocs organization](https://github.com/orgs/MicrosoftDocs/repositories) are resolved from their published source metadata, so they do not require a hard-coded route.

## Develop locally

Requires Node.js 20 or later.

```bash
npm install
npm test
npm run preview
```

Open `http://127.0.0.1:4173/`. To launch the diff page directly, use the portable path form:

```text
http://127.0.0.1:4173/en-us/entra/identity/conditional-access/overview
```

The legacy query interface remains supported:

```text
http://127.0.0.1:4173/?url=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Fentra%2Fidentity%2Fconditional-access%2Foverview
```

Non-Learn sites with reviewed mappings, such as Aspire, use the query form:

```text
http://127.0.0.1:4173/?url=https%3A%2F%2Faspire.dev%2Fget-started%2Fwhat-is-aspire%2F
```

The shortest repeatable workflow is:

```bash
npm run build
npm run preview
```

Then paste the direct local URL above into the browser. The preview server serves the built diff page and falls back to it for unknown paths, matching the production SPA behavior.

`npm run build` creates the deployable `dist/` directory. The build:

- generates all static HTML and SEO files;
- emits a Pages Functions route manifest limited to `/api/*`;
- copies first-party browser assets;
- vendors `marked`, `diff`, and `node-htmldiff` from npm;
- emits their third-party licenses;
- adds Cloudflare Pages security headers;
- deliberately omits `404.html` so Pages uses SPA fallback for Learn paths.

## URL interface

- `https://learn.microsoftx.com/<learn-path>?<learn-query>#<fragment>` maps to the equivalent `https://learn.microsoft.com` URL.
- `https://<any-configured-domain>/<learn-path>?<learn-query>#<fragment>` provides the same comparison without relying on the MicrosoftX domain.
- Reviewed documentation outside Microsoft Learn uses `/?url=<encoded-documentation-url>`; this includes current `https://aspire.dev/` articles.
- `/`, `/about/`, `/supported/`, and `/privacy/` are reserved static site routes; other non-empty paths are treated as Learn diff paths.
- Remote deployments must use HTTPS. Plain HTTP is accepted only on localhost for development.
- Learn query parameters are preserved, including Microsoft Graph's `view=graph-rest-beta` and `view=graph-rest-1.0` selectors.
- `_mx_head=<sha>` compares a selected commit with its first parent.
- `_mx_base=<sha>&_mx_head=<sha>` compares two exact revisions.
- `_mx_view=markdown` reopens the Markdown tab; the visual diff is the default.
- `_mx_base`, `_mx_head`, and `_mx_view` are removed before reconstructing the Learn URL.
- After a comparison loads, the address bar is replaced with the exact base/head SHAs. Copying it—or using **Copy link to this view**—therefore reopens the same versions and selected tab.

## Source lookup, GitHub access, and privacy

Routes in the reviewed configuration resolve locally. For other routes—and to verify broad Azure, Microsoft 365, Dynamics 365, and SQL routes—the browser calls the same-origin `/api/resolve-source` endpoint. The Pages Function fetches only HTTPS pages on `learn.microsoft.com`, follows redirects only on that hostname, limits response size, extracts `github_feedback_content_git_url`, and accepts only documentation files in `MicrosoftDocs/*` repositories. The local preview server implements the same endpoint for development.

The Microsoft Learn URL is therefore visible to the Docs X-Ray host, Cloudflare, and Microsoft Learn during dynamic source lookup. GitHub history, revisions, rendered content, diffs, and the optional token remain outside that function.

Anonymous GitHub access is always attempted first. The UI does not show request counts during normal use. If GitHub reports an exhausted limit or rejected credential, Microsoft Docs X-Ray offers API settings.

An optional fine-grained token is stored in the visitor's origin-scoped `localStorage`. A token saved on one domain is not available to another domain and must be added separately there. Request code rejects every token-bearing endpoint whose protocol and hostname are not exactly `https://api.github.com`.

Site feedback is provided through UserJot. The widget is initialized on every page and can be opened from either its floating launcher or the footer feedback button. The optional GitHub token is never sent to UserJot.

Rendered Markdown is sanitized before it is inserted into the page. Scripts, frames, forms, active content, event attributes, inline styles, and unsafe protocols are removed.

## Deploy

Follow [`docs/cloudflare-setup.md`](docs/cloudflare-setup.md) for the Cloudflare Pages project, exact custom domains, wildcard DNS record, redirect rule, no-index response header, certificate gate, and launch checks.

Recommended Pages configuration:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `20` or later |

The build uses `https://microsoftx.com` as the indexed SEO origin by default. Set `CANONICAL_ORIGIN` to another path-free HTTPS origin only when intentionally changing the primary site. Navigation and runtime assets remain root-relative regardless of this setting; canonical tags, Open Graph URLs, structured data, `robots.txt`, and `sitemap.xml` remain absolute as required for SEO.

## Tests

`npm test` builds the production artifact and runs Node tests covering:

- shortcut, portable-domain, and revision URL parsing;
- every configured documentation area;
- Defender docsets and dynamic MicrosoftDocs source validation;
- Microsoft Graph query-specific mappings;
- the pinned Microsoft 365 Shadow AI sample revision;
- unsafe path rejection and HTML sanitization;
- GitHub-origin token enforcement;
- latest and exact revision loading;
- rate-limit behavior;
- static SEO metadata, structured data, sitemap, local asset integrity, and security headers.

## License

Microsoft Docs X-Ray is available under the [MIT License](LICENSE). Vendored browser-library licenses are emitted to `dist/assets/vendor/THIRD_PARTY_LICENSES.txt` during the build.

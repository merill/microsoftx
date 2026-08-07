# MicrosoftX

MicrosoftX is a static, client-side Microsoft Learn page-diff viewer. Change a supported URL from:

```text
https://learn.microsoft.com/en-us/entra/identity/conditional-access/overview
```

to:

```text
https://learn.microsoftx.com/en-us/entra/identity/conditional-access/overview
```

The browser maps the Learn path to a public GitHub repository, loads the two latest commits that changed the Markdown file, and renders visual and Markdown diffs locally.

MicrosoftX is an independent community project and is not affiliated with Microsoft.

## Architecture

- `microsoftx.com` serves indexed static Home, About, Supported, and Privacy pages.
- `learn.microsoftx.com` serves the same Cloudflare Pages project. Unknown paths receive the root SPA document, which reconstructs the corresponding `learn.microsoft.com` URL and loads the diff.
- Other `*.microsoftx.com` hostnames are redirected to the apex by a Cloudflare zone rule.
- The browser contacts only `api.github.com` for comparison data. Relative documentation images can load from `raw.githubusercontent.com`.
- There is no Worker script, Pages Function, application server, database, or shared GitHub token.

The source list in [`src/diff-config.js`](src/diff-config.js) currently covers Microsoft Entra, Azure, Microsoft Graph, .NET, PowerShell, Microsoft 365, Intune, Fabric, Dynamics 365, SQL, Visual Studio, ASP.NET Core, and Windows Server.

## Develop locally

Requires Node.js 20 or later.

```bash
npm install
npm test
npm run preview
```

Open `http://127.0.0.1:4173/`. To preview a comparison locally, pass a Learn URL through the development query interface:

```text
http://127.0.0.1:4173/?url=https%3A%2F%2Flearn.microsoft.com%2Fen-us%2Fentra%2Fidentity%2Fconditional-access%2Foverview
```

`npm run build` creates the deployable `dist/` directory. The build:

- generates all static HTML and SEO files;
- copies first-party browser assets;
- vendors `marked`, `diff`, and `node-htmldiff` from npm;
- emits their third-party licenses;
- adds Cloudflare Pages security headers;
- deliberately omits `404.html` so Pages uses SPA fallback for Learn paths.

## URL interface

- `https://learn.microsoftx.com/<learn-path>?<learn-query>#<fragment>` maps to the equivalent `https://learn.microsoft.com` URL.
- Learn query parameters are preserved, including Microsoft Graph's `view=graph-rest-beta` and `view=graph-rest-1.0` selectors.
- `_mx_head=<sha>` compares a selected commit with its first parent.
- `_mx_base=<sha>&_mx_head=<sha>` compares two exact revisions.
- `_mx_base` and `_mx_head` are removed before reconstructing the Learn URL.

## GitHub access and privacy

Anonymous GitHub access is always attempted first. The UI does not show request counts during normal use. If GitHub reports an exhausted limit or rejected credential, MicrosoftX offers API settings.

An optional fine-grained token is stored in the visitor's `localStorage`. Request code rejects every token-bearing endpoint whose protocol and hostname are not exactly `https://api.github.com`.

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

## Tests

`npm test` builds the production artifact and runs Node tests covering:

- shortcut and revision URL parsing;
- every configured documentation area;
- Microsoft Graph query-specific mappings;
- the SMS/voice retirement example;
- unsafe path rejection and HTML sanitization;
- GitHub-origin token enforcement;
- latest and exact revision loading;
- rate-limit behavior;
- static SEO metadata, structured data, sitemap, local asset integrity, and security headers.

## License

MicrosoftX is available under the [MIT License](LICENSE). Vendored browser-library licenses are emitted to `dist/assets/vendor/THIRD_PARTY_LICENSES.txt` during the build.

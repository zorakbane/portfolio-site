# Go-live checklist for derickjanssen.com

**Do not change DNS, enable GitHub Pages on the public repo, or set a Pages custom domain until this checklist is approved.** The live site is still the old host. Nothing in this file has been applied to DNS or Pages.

Prepared: 2026-11-11 12:07 AM EST (America/New_York). Updated: 2026-11-11 8:30 AM EST (America/New_York) for the two-repo split. DNS was looked up via Cloudflare and Google DNS-over-HTTPS (`dig` was not available on the build box; queries used `https://cloudflare-dns.com/dns-query` and `https://dns.google/resolve`).

## Two-repo layout (approved; not live yet)

Derick approved serving the production site from a build-only public repo, with the source repo able to go private later.

| Repo | Role | Visibility now |
| --- | --- | --- |
| [`zorakbane/portfolio-site`](https://github.com/zorakbane/portfolio-site) | Source: builder, project data, design notes, tools, tests | **Stays public** until Derick separately OK's making it private |
| [`zorakbane/portfolio-site-public`](https://github.com/zorakbane/portfolio-site-public) | Production build output only (HTML/CSS/JS/media, `resume.pdf`, `robots.txt`, `sitemap.xml`, `CNAME`) | Public. **GitHub Pages is not enabled.** No custom domain is set. |

Making `portfolio-site` private is a **separate step** and must not happen until Derick says so.

Publish a new production artifact with:

```bash
bash tools/deploy-public.sh
# or: npm run deploy:public
```

That script builds `BASE=/ PUBLISH_CNAME=1 node build.mjs --hide-todos`, adds a short public README (not the source design doc), copies `dist/` onto `portfolio-site-public` `main`, commits (history kept), tags `release-YYYYMMDD-HHMM` in America/New_York, and fast-forward pushes. It never force-pushes, never enables Pages, and never changes DNS.

The current preview at `https://zorakbane.github.io/portfolio-site/` is still published from `portfolio-site` `gh-pages` via `tools/deploy-preview.sh` (`BASE=/portfolio-site/`, `CNAME` stripped, `robots.txt` Disallow). That preview is independent of the public production repo.

## Previews after the source repo goes private

On GitHub’s free plan, Pages from a **private** repo is not publicly served. If `portfolio-site` is made private without another preview host, `https://zorakbane.github.io/portfolio-site/` will stop working (unless the account is on a paid plan that includes Pages for private repos).

Do not privatize until a preview replacement is in place. Options, in preferred order:

1. **Recommended: Cloudflare Pages or Netlify previews from the private source repo.** Connect `portfolio-site` (once private) to Cloudflare Pages or Netlify. Pull requests get unique `*.pages.dev` or `*.netlify.app` URLs. Build with a non-root `BASE` (or their default preview URL) so asset paths resolve, and keep preview `robots.txt` on `Disallow: /` plus `noindex`. Production GitHub Pages stays on `portfolio-site-public`. This does not require GitHub Pro and does not put a staging copy on derickjanssen.com.
2. **Paid GitHub (Pro / Team):** keep `tools/deploy-preview.sh` as it is; private-repo Pages can remain publicly reachable.
3. **Avoid once the custom domain is live:** a `/preview/` folder (or similar) on `portfolio-site-public` `main`. GitHub Pages serves one site per repo, so after cutover that path would also be visible at `https://derickjanssen.com/preview/`. A `noindex` meta would discourage crawlers but would not hide a work-in-progress build from anyone with the URL.

Until privatization is approved, keep using `tools/deploy-preview.sh`.

## Current hosting (do not change yet)

Nameservers are GoDaddy (`ns59.domaincontrol.com`, `ns60.domaincontrol.com`). SOA serial `2026071001` (host `ns59.domaincontrol.com` / `dns.jomax.net`).

| Name | Type | Data | What it is |
| --- | --- | --- | --- |
| `derickjanssen.com` | A | `3.33.251.168` | GoDaddy / AWS domain-forwarding anycast |
| `derickjanssen.com` | A | `15.197.225.128` | GoDaddy / AWS domain-forwarding anycast |
| `derickjanssen.com` | AAAA | — | none |
| `derickjanssen.com` | CNAME | — | none (apex) |
| `derickjanssen.com` | MX | `0 smtp.secureserver.net` | **GoDaddy email — keep** |
| `derickjanssen.com` | MX | `10 mailstore1.secureserver.net` | **GoDaddy email — keep** |
| `derickjanssen.com` | TXT | `google-site-verification=oa98xuw1qx7MYG99Ba6-GYVJah8KTgDW3bE7ZEcgGFM` | Google site verification — keep unless you replace it |
| `www.derickjanssen.com` | CNAME | `ghs.googlehosted.com` | **Old site: Google Sites** |
| `www.derickjanssen.com` | A / AAAA | (via Google) `192.179.24.121` / `2607:f8b0:4004:c19::79` (varies by resolver) | Google Sites backends |

The apex is GoDaddy forwarding (those two A records are the usual forwarding pair). `www` is the old Google Sites portfolio. Email is on GoDaddy (`secureserver.net`).

## Preserve before anything else

- **MX records** above. Changing or deleting them breaks `@derickjanssen.com` mail.
- Any other mail-related records you add later (SPF `TXT`, DKIM, DMARC). None besides the Google verification TXT were present at lookup time.
- Nameservers can stay at GoDaddy (`ns59` / `ns60.domaincontrol.com`) — only the records change, not the registrar.
- Turn **off** GoDaddy “Domain Forwarding” for the apex before you replace the forwarding A records, or GoDaddy may rewrite them.

## Production build

```bash
BASE=/ PUBLISH_CNAME=1 node build.mjs --hide-todos
# or just: bash tools/deploy-public.sh
```

Verification that should hold:

- Asset, script, and favicon URLs are root-relative (`/js/main.js?v=…`, `/favicon.svg`, `/img/…`).
- In-site links are `/`, `/projects/<slug>/`, and `/#section`.
- `404.html` exists (GitHub Pages will serve it) and “Respawn at home” points at `/`.
- Canonical and `og:url` are `https://derickjanssen.com/` (home) and `https://derickjanssen.com/projects/<slug>/`.
- `sitemap.xml` lists those canonical URLs; `robots.txt` allows crawlers and points at the sitemap.
- `resume.pdf` is present and linked as `Derick-Janssen-Resume.pdf`.
- `CNAME` contains `derickjanssen.com`.

`tools/deploy-preview.sh` always builds with `BASE=/portfolio-site/` and deletes `CNAME`. It cannot make derickjanssen.com live.

## CNAME file

`static/CNAME` (and the copy published by `deploy-public.sh`) contains:

```
derickjanssen.com
```

That makes the apex the GitHub Pages primary domain once Pages is enabled (canonical URLs match). GitHub will treat `www` as an alias and redirect it to `https://derickjanssen.com` once the DNS records below are in place **and** Pages + the custom domain are configured on `portfolio-site-public`.

The file is included in `portfolio-site-public` so a later Pages enable can pick it up. **Because Pages is not enabled there yet, this file does not attach the domain and does not affect DNS.** Preview deploys on `portfolio-site` `gh-pages` still strip `CNAME`. Do not enable Pages or set a custom domain until the DNS cutover is approved.

## GoDaddy DNS records to set (when approved)

In GoDaddy → **My Products → derickjanssen.com → DNS → Manage DNS**.

### Keep unchanged

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| MX | `@` | `smtp.secureserver.net` (priority 0) | 1 hour |
| MX | `@` | `mailstore1.secureserver.net` (priority 10) | 1 hour |
| TXT | `@` | `google-site-verification=oa98xuw1qx7MYG99Ba6-GYVJah8KTgDW3bE7ZEcgGFM` | (optional keep) |
| NS | — | `ns59.domaincontrol.com` / `ns60.domaincontrol.com` | — |

### Change / add for GitHub Pages

1. Disable GoDaddy domain forwarding for `@` if it is on.
2. **Remove** the two apex **A** records `3.33.251.168` and `15.197.225.128`.
3. **Add** apex **A** records for `@`:
   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`
4. **Add** apex **AAAA** records for `@`:
   - `2606:50c0:8000::153`
   - `2606:50c0:8001::153`
   - `2606:50c0:8002::153`
   - `2606:50c0:8003::153`
5. **Change** the `www` **CNAME** from `ghs.googlehosted.com` to `zorakbane.github.io`.

Leave MX (and mail TXT) records alone.

## GitHub Pages custom domain + HTTPS (when approved)

Do these on **`zorakbane/portfolio-site-public`**, not on the source repo. Do not do them until the cutover is approved.

1. Confirm `main` on `portfolio-site-public` has a current `BASE=/` build (run `tools/deploy-public.sh` from the source repo if needed).
2. Repo **Settings → Pages → Build and deployment:** Deploy from a branch, branch `main`, folder `/ (root)`.
3. **Settings → Pages → Custom domain:** enter `derickjanssen.com`.
4. Save, wait for DNS checks to go green (can take minutes to a few hours after the GoDaddy records propagate).
5. Tick **Enforce HTTPS** once the certificate is issued. Do not tick it before the check passes.
6. Optional: **Settings → Pages → Verified domains** so nobody else can claim the name.
7. Confirm:
   - `https://derickjanssen.com/` loads the new site (not a `/portfolio-site/` prefix).
   - `https://www.derickjanssen.com/` redirects to the apex.
   - `https://derickjanssen.com/projects/rise-of-elements/` (and other project URLs) work.
   - `https://derickjanssen.com/resume.pdf` downloads the resume.
   - A bogus path serves `404.html`.
   - Favicon and images load from `/favicon.svg` and `/img/…`.
   - Email still sends and receives.

## Rollback to the old site

If the cutover needs to be undone, put the previous records back **without touching MX**:

1. Restore apex **A** records `3.33.251.168` and `15.197.225.128` (and remove the GitHub A/AAAA records). Re-enable GoDaddy forwarding if that is how those two addresses were managed.
2. Restore `www` **CNAME** `ghs.googlehosted.com`.
3. In `portfolio-site-public` **Settings → Pages**, remove the custom domain `derickjanssen.com` (and uncheck Enforce HTTPS if GitHub leaves it stuck). You can also turn Pages off there.
4. The old Google Sites site at `www` and the GoDaddy apex forward come back as DNS propagates. The GitHub preview at `https://zorakbane.github.io/portfolio-site/` can stay up the whole time (while the source repo remains public).

## After approval, suggested order

1. Merge the outstanding source PR (resume + public deploy script) into `portfolio-site` `main` if it is not already there.
2. Run `tools/deploy-public.sh` so `portfolio-site-public` `main` is current. Still **do not** enable Pages.
3. When the cutover is approved: enable Pages on `portfolio-site-public` (`main` / root), add the GitHub Pages A/AAAA records, and change the `www` CNAME (MX untouched).
4. Set the Pages custom domain, wait for DNS, then Enforce HTTPS.
5. Watch email for a few hours. Keep this file’s current-record table so rollback stays copy-pasteable.
6. Only after the new site is stable — and only with Derick’s OK — consider making `portfolio-site` private. Switch previews to Cloudflare Pages or Netlify first (see above) so the `github.io/portfolio-site` preview is not the only staging URL.

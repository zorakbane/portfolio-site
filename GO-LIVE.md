# Go-live checklist for derickjanssen.com

**Do not change DNS, the GitHub Pages custom domain, or publish the `CNAME` file until this checklist is approved.** The public site is still the old host. The GitHub preview at `https://zorakbane.github.io/portfolio-site/` is safe to update independently.

Prepared: 2026-11-11 12:07 AM EST (America/New_York). DNS was looked up via Cloudflare and Google DNS-over-HTTPS (`dig` was not available on the build box; queries used `https://cloudflare-dns.com/dns-query` and `https://dns.google/resolve`).

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

## Production build (already supported)

```bash
BASE=/ node build.mjs --hide-todos
# default BASE is already /
```

Verification that should hold:

- Asset, script, and favicon URLs are root-relative (`/js/main.js?v=…`, `/favicon.svg`, `/img/…`).
- In-site links are `/`, `/projects/<slug>/`, and `/#section`.
- `404.html` exists (GitHub Pages will serve it) and “Respawn at home” points at `/`.
- Canonical and `og:url` are `https://derickjanssen.com/` (home) and `https://derickjanssen.com/projects/<slug>/`.
- `sitemap.xml` lists those canonical URLs; `robots.txt` allows crawlers and points at the sitemap.
- `CNAME` is **not** written to `dist/` unless `PUBLISH_CNAME=1`.

When go-live is approved, produce the production artifact with:

```bash
BASE=/ PUBLISH_CNAME=1 node build.mjs --hide-todos
```

`tools/deploy-preview.sh` always builds with `BASE=/portfolio-site/` and deletes `CNAME`. It cannot make derickjanssen.com live.

## CNAME file plan (not deployed until approved)

`static/CNAME` is planned to contain:

```
derickjanssen.com
```

That makes the apex the GitHub Pages primary domain (canonical URLs match). GitHub will treat `www` as an alias and redirect it to `https://derickjanssen.com` once both DNS records below are in place.

Do **not** commit this file onto `gh-pages` until you are ready to attach the custom domain. Preview deploys strip it. Default builds omit it. Production builds include it only with `PUBLISH_CNAME=1`.

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

## GitHub Pages custom domain + HTTPS

1. Ship a production build (`BASE=/` and, when you are ready, `PUBLISH_CNAME=1`) to the GitHub Pages source (today that is the `gh-pages` branch; `.github/workflows/pages.yml` is manual `workflow_dispatch` only).
2. Repo **Settings → Pages → Custom domain:** enter `derickjanssen.com`.
3. Save, wait for DNS checks to go green (can take minutes to a few hours after the GoDaddy records propagate).
4. Tick **Enforce HTTPS** once the certificate is issued. Do not tick it before the check passes.
5. Optional: **Settings → Pages → Verified domains** so nobody else can claim the name.
6. Confirm:
   - `https://derickjanssen.com/` loads the new site (not a `/portfolio-site/` prefix).
   - `https://www.derickjanssen.com/` redirects to the apex.
   - `https://derickjanssen.com/projects/rise-of-elements/` (and other project URLs) work.
   - A bogus path serves `404.html`.
   - Favicon and images load from `/favicon.svg` and `/img/…`.
   - Email still sends and receives.

## Rollback to the old site

If the cutover needs to be undone, put the previous records back **without touching MX**:

1. Restore apex **A** records `3.33.251.168` and `15.197.225.128` (and remove the GitHub A/AAAA records). Re-enable GoDaddy forwarding if that is how those two addresses were managed.
2. Restore `www` **CNAME** `ghs.googlehosted.com`.
3. In GitHub **Settings → Pages**, remove the custom domain `derickjanssen.com` (and uncheck Enforce HTTPS if GitHub leaves it stuck).
4. Remove `CNAME` from the published Pages root if it was uploaded (`PUBLISH_CNAME=1`).
5. The old Google Sites site at `www` and the GoDaddy apex forward come back as DNS propagates. The GitHub preview at `https://zorakbane.github.io/portfolio-site/` can stay up the whole time.

## After approval, suggested order

1. Merge or otherwise ship the production `BASE=/` build, still **without** publishing `CNAME` if you want a last preview at the `github.io` URL with root paths tested locally.
2. Add the GitHub Pages A/AAAA records and change the `www` CNAME (MX untouched).
3. Set the Pages custom domain, wait for DNS, then Enforce HTTPS.
4. Publish `CNAME` (`PUBLISH_CNAME=1`) if GitHub did not already write it.
5. Watch email for a few hours. Keep this file’s current-record table so rollback stays copy-pasteable.

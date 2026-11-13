# How to deploy derickjanssen.com

This is a short guide for updating the portfolio and, when you're ready, pointing derickjanssen.com at it. You don't have to memorize any of this — follow the section you need.

A formatted copy also lives in Google Drive: [Portfolio Site - Deploy Guide](https://docs.google.com/document/d/1tr5BcPXeZ70qFYOTX5eCwmFZEjg47veFxzrzFIkz_4A/edit).

## The two repos

| Repo | What it is |
| --- | --- |
| [zorakbane/portfolio-site](https://github.com/zorakbane/portfolio-site) | The **source** repo: project data, images, the builder, and this guide. This is the one you edit. It can go private later. |
| [zorakbane/portfolio-site-public](https://github.com/zorakbane/portfolio-site-public) | The **public build** repo: only the finished website (HTML, CSS, JavaScript, images, resume). Don't edit files here by hand — they're overwritten on each production deploy. |

The preview at [zorakbane.github.io/portfolio-site](https://zorakbane.github.io/portfolio-site/) is published from the source repo's `gh-pages` branch. Production will be published from the public repo.

## Edit the site

Work on a branch in the source repo, not in the public repo.

- Project write-ups, tags, and links: `data/projects.json`
- Resume PDF, images, and the site icon: `static/`
- Look and layout: `static/css/site.css` and `build.mjs`

After you edit, build and check locally, then preview, then (once it looks right) merge and deploy to production.

## Build locally

You need [Node.js](https://nodejs.org/) installed. In the source repo:

```bash
node build.mjs              # writes the site into dist/
node build.mjs --hide-todos # same build preview and production use
npm run serve               # build, then open http://127.0.0.1:8080
```

Leave `--hide-todos` off if you want orange TODO notes on the page while you work.

## Check your work

1. Run `node build.mjs --hide-todos`.
2. Run `npm run serve` and click through the home page, a project page, the resume download, and the About section.
3. Publish a preview (next section) and check it on your phone too.

## Preview

```bash
bash tools/deploy-preview.sh
# or: npm run deploy:preview
```

This builds the site for the preview URL (`BASE=/portfolio-site/`), pushes it to the source repo's `gh-pages` branch, and tags `preview-YYYYMMDD-HHMM` in Eastern Time. It never force-pushes, and it never points derickjanssen.com at the preview.

When it finishes, open [https://zorakbane.github.io/portfolio-site/](https://zorakbane.github.io/portfolio-site/).

## Production

```bash
bash tools/deploy-public.sh
# or: npm run deploy:public
```

This builds the real site (`BASE=/`, includes the `CNAME` file), copies `dist/` onto `portfolio-site-public` on branch `main`, and tags `release-YYYYMMDD-HHMM` in Eastern Time. It never force-pushes, and it does **not** turn on GitHub Pages or change DNS by itself.

After the one-time go-live steps below, this is the command that updates derickjanssen.com.

## Roll back a production deploy

Each production push is tagged `release-YYYYMMDD-HHMM` on `portfolio-site-public`. Don't force-push.

The safe way to undo a bad deploy:

1. In the source repo, go back to the commit that produced the last good `release-*` tag (or otherwise restore the last good content).
2. Run `bash tools/deploy-public.sh` again.

That publishes a new `release-*` tag with the last good site and leaves history intact. You can list tags with:

```bash
git ls-remote --tags https://github.com/zorakbane/portfolio-site-public.git 'release-*'
```

## Updating the site later

Once the domain is live, everyday updates follow this loop:

1. **Edit** the source (usually `data/projects.json` or files in `static/`).
2. **Test** — build, serve locally, and click through.
3. **Preview** — `bash tools/deploy-preview.sh`, then check the preview URL.
4. **Merge** your branch into `main` on the source repo.
5. **Deploy production** — `bash tools/deploy-public.sh`.
6. **Roll back** with a `release-*` tag if something is wrong (see above).

## Going live (one time)

Do these in order when you're ready to switch derickjanssen.com over. This is separate from an everyday production deploy.

1. Merge the pull request that adds the analytics beacon and this guide into `main`.
2. Run `bash tools/deploy-public.sh` so the public repo has the latest site (including the `CNAME` file).
3. On **portfolio-site-public** (not the source repo): **Settings → Pages**. Deploy from branch `main`, folder `/ (root)`. Under Custom domain, enter `derickjanssen.com` and save.
4. In **GoDaddy**, open **My Products → derickjanssen.com → DNS**. First turn off **Domain Forwarding** for the apex (`@`), or GoDaddy may put the old A records back. Then set the records in the next section. **Do not touch MX or the other mail records.**
5. After GitHub Pages shows the domain as verified (this can take a few minutes to a few hours), turn on **Enforce HTTPS**. GitHub may need up to 24 hours before that checkbox is available.
6. After the new site has been stable, make the **source** repo (`portfolio-site`) private. On GitHub's free plan, the current `github.io/portfolio-site` preview stops working once the source is private, so switch previews to Cloudflare Pages or Netlify first (or use a paid GitHub plan). Don't privatize until you say so and a preview replacement is in place.

## One-time GoDaddy DNS records

Nameservers can stay at GoDaddy (`ns59.domaincontrol.com` and `ns60.domaincontrol.com`). Only the website records change.

GitHub Pages IPs below were checked against [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) and `https://api.github.com/meta` on November 12, 2026.

### Keep (mail and verification)

| Type | Name | Value |
| --- | --- | --- |
| MX | `@` | `smtp.secureserver.net` (priority 0) |
| MX | `@` | `mailstore1.secureserver.net` (priority 10) |
| TXT | `@` | `google-site-verification=oa98xuw1qx7MYG99Ba6-GYVJah8KTgDW3bE7ZEcgGFM` (optional keep) |
| CNAME | `email` | `email.secureserver.net` |
| CNAME | `smtp` | `smtp.secureserver.net` |
| CNAME | `imap` | `imap.secureserver.net` |
| CNAME | `pop` | `pop.secureserver.net` |
| CNAME | `mail` | `pop.secureserver.net` |
| CNAME | `webmail` | `webmail.secureserver.net` |
| CNAME | `mobilemail` | `mobilemail-v01.prod.mesa1.secureserver.net` |
| CNAME | `pda` | `mobilemail-v01.prod.mesa1.secureserver.net` |

### Change or add (the website)

1. Turn off Domain Forwarding for `@`.
2. **Replace** the apex (`@`) A records `3.33.251.168` and `15.197.225.128` with these four:

   - `185.199.108.153`
   - `185.199.109.153`
   - `185.199.110.153`
   - `185.199.111.153`

3. **Add** these apex (`@`) AAAA records:

   - `2606:50c0:8000::153`
   - `2606:50c0:8001::153`
   - `2606:50c0:8002::153`
   - `2606:50c0:8003::153`

4. **Change** the `www` CNAME from `ghs.googlehosted.com` to `zorakbane.github.io` (the username only — do not add `/portfolio-site`).

DNS can take up to 24 hours to propagate. Until then, the old Google Sites site may still appear at `www`, and the apex may still forward.

A longer checklist, including how to undo the domain cutover, is in [GO-LIVE.md](GO-LIVE.md).

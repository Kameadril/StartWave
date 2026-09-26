# BDO subdomain migration

The canonical public BDO origin is `https://bdo.startwave.space`.

## Public URL contract

- BDO home: `https://bdo.startwave.space/`
- BDO sections: `https://bdo.startwave.space/<section>`
- BDO canonical and Open Graph URLs never use `startwave.space/bdo`.
- The main StartWave Games Hub links directly to the BDO subdomain.

The BDO build writes `dist-bdo/robots.txt` and `dist-bdo/sitemap.xml`. It also
adds canonical and `og:url` metadata to every generated BDO HTML document.

## Compatibility redirects

The main StartWave build writes these permanent redirects to `dist/_redirects`:

```text
/bdo https://bdo.startwave.space/ 301
/bdo/ https://bdo.startwave.space/ 301
/bdo/* https://bdo.startwave.space/:splat 301
/bdo.html https://bdo.startwave.space/ 301
/pages/bdo-*.html https://bdo.startwave.space/:splat 301
```

They are valid for the current Cloudflare Workers Static Assets deployment
because the main Worker owns `startwave.space` and `_redirects` is generated
inside its asset directory. The BDO Worker separately owns the custom domain
declared in `wrangler.bdo.jsonc`.

## Production switch

Production deployment is intentionally manual:

1. Run `npm run build` and `npm run build:bdo`.
2. Deploy the BDO Worker with `wrangler deploy --config wrangler.bdo.jsonc`.
3. Verify the custom domain, representative BDO pages, canonical metadata,
   sitemap, robots policy, assets, and LIVE Items read path.
4. Deploy the main Worker with `wrangler deploy --config wrangler.jsonc`.
5. Verify `301` responses for `/bdo`, `/bdo/<path>`, `/bdo.html`, and an old
   `/pages/bdo-*.html` URL before announcing the migration complete.

Do not reverse steps 2 and 4: the redirect target must be live before old URLs
begin forwarding production traffic.

/**
 * Releases proxy — lets the desktop-download page work while the GitHub repo is
 * PRIVATE. A private repo's releases and asset downloads require authentication,
 * so the browser's anonymous call to api.github.com 404s (and the public
 * /releases page shows a sign-in wall). This route holds a GitHub token
 * SERVER-SIDE (never sent to the browser) and relays what the client needs.
 *
 * GET /api/releases
 *   Lists releases (newest-first, drafts excluded). Each asset is returned with
 *   only { id, name, size } plus a proxied download path — never the private
 *   browser_download_url, which anonymous clients can't use.
 *
 * GET /api/releases/assets/:id
 *   Downloads one asset. Hits the GitHub asset API with
 *   `Accept: application/octet-stream` + token; GitHub replies 302 to a
 *   short-lived signed URL that needs no auth, which we hand back as a redirect
 *   so the binary streams straight from GitHub's CDN, not through us.
 *
 * Configure with two env vars (see .env.example):
 *   GITHUB_RELEASES_REPO   owner/repo (defaults to Hunter52302/life-calendar)
 *   GITHUB_RELEASES_TOKEN  a fine-grained PAT with read-only "Contents" on that repo
 */
import { Router } from 'express';

const router = Router();

const GITHUB_REPO  = process.env.GITHUB_RELEASES_REPO ?? 'Hunter52302/life-calendar';
const GITHUB_TOKEN = process.env.GITHUB_RELEASES_TOKEN ?? '';
const API_ROOT     = 'https://api.github.com';
const TIMEOUT_MS   = 15_000;
const CACHE_MS     = 60_000; // GitHub rate-limits authed calls to 5000/hr — cache the listing

let listCache = { at: 0, data: null };

function ghHeaders(extra = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'PLS-Calendar',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

router.get('/', async (_req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(503).json({ error: 'Releases are not configured on the server.' });
  }
  if (listCache.data && Date.now() - listCache.at < CACHE_MS) {
    return res.json(listCache.data);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${API_ROOT}/repos/${GITHUB_REPO}/releases?per_page=10`, {
      headers: ghHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!r.ok) {
      return res.status(502).json({ error: `GitHub responded ${r.status}.` });
    }
    const list = await r.json();
    const releases = (Array.isArray(list) ? list : [])
      .filter(rel => !rel.draft)
      .map(rel => ({
        tag_name:     rel.tag_name,
        name:         rel.name,
        published_at: rel.published_at,
        prerelease:   rel.prerelease,
        assets: (rel.assets ?? []).map(a => ({ id: a.id, name: a.name, size: a.size })),
      }));
    listCache = { at: Date.now(), data: releases };
    res.json(releases);
  } catch (err) {
    clearTimeout(timer);
    res.status(502).json({ error: 'Could not reach GitHub.', details: err.message });
  }
});

router.get('/assets/:id', async (req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(503).json({ error: 'Releases are not configured on the server.' });
  }
  const { id } = req.params;
  if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid asset id.' });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${API_ROOT}/repos/${GITHUB_REPO}/releases/assets/${id}`, {
      headers: ghHeaders({ Accept: 'application/octet-stream' }),
      redirect: 'manual',
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Normal path: GitHub 302s to a short-lived signed CDN URL that needs no
    // auth — bounce the client there so the binary never streams through us.
    const location = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && location) {
      return res.redirect(302, location);
    }
    // Fallback: some responses return the bytes inline instead of redirecting.
    if (r.ok) {
      res.setHeader('Content-Type', r.headers.get('content-type') ?? 'application/octet-stream');
      const disposition = r.headers.get('content-disposition');
      if (disposition) res.setHeader('Content-Disposition', disposition);
      return res.send(Buffer.from(await r.arrayBuffer()));
    }
    return res.status(502).json({ error: `GitHub responded ${r.status}.` });
  } catch (err) {
    clearTimeout(timer);
    res.status(502).json({ error: 'Could not download asset.', details: err.message });
  }
});

export default router;

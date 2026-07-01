import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pbUserLlmSettings } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pbUserLlmSettings.get(req.userId));
}));

router.put('/', asyncHandler(async (req, res) => {
  const { provider, apiKey, endpoint, model } = req.body;
  await pbUserLlmSettings.set(req.userId, {
    provider: provider ?? 'none',
    apiKey:   apiKey   ?? null,
    endpoint: endpoint ?? null,
    model:    model    ?? null,
  });
  res.json({ ok: true });
}));

export default router;

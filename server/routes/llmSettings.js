import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { userLlmSettings } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(userLlmSettings.get(req.userId));
});

router.put('/', (req, res) => {
  const { provider, apiKey, endpoint, model } = req.body;
  userLlmSettings.set(req.userId, {
    provider: provider ?? 'none',
    apiKey:   apiKey   ?? null,
    endpoint: endpoint ?? null,
    model:    model    ?? null,
  });
  res.json({ ok: true });
});

export default router;

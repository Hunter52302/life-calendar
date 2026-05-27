import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { pushSubscriptions, userIntegrations } from '../db/queries.js';

const router = Router();

// Unauthenticated — the public VAPID key must be available before auth
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured on this server' });
  res.json({ publicKey: key });
});

router.use(requireAuth);

router.post('/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription.endpoint required' });
  pushSubscriptions.upsert(req.userId, randomUUID(), subscription);

  // Auto-create a web_push integration row if one doesn't exist yet
  const existing = userIntegrations.getAll(req.userId).find(i => i.type === 'web_push');
  if (!existing) {
    userIntegrations.create(req.userId, {
      id: randomUUID(),
      type: 'web_push',
      label: 'Browser Push',
      enabled: true,
    });
  }

  res.json({ ok: true });
});

router.delete('/subscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  pushSubscriptions.deleteByEndpoint(req.userId, endpoint);
  res.status(204).end();
});

router.post('/expo-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  // Upsert expo_push integration with the new token
  const existing = userIntegrations.getAll(req.userId).find(i => i.type === 'expo_push');
  if (existing) {
    userIntegrations.update(req.userId, existing.id, { push_token: token, enabled: true });
  } else {
    userIntegrations.create(req.userId, {
      id: randomUUID(),
      type: 'expo_push',
      label: 'Mobile Push',
      push_token: token,
      enabled: true,
    });
  }

  res.json({ ok: true });
});

export default router;

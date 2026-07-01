import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { pocketbasePushSubscriptions } from '../lib/pocketbaseOperational.js';
import { pocketbaseUserIntegrations } from '../lib/pocketbaseNotifications.js';

const router = Router();

// Unauthenticated — the public VAPID key must be available before auth
router.get('/vapid-public-key', (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: 'Push notifications not configured on this server' });
  res.json({ publicKey: key });
});

router.use(requireAuth);

router.post('/subscribe', async (req, res, next) => {
  try {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription.endpoint required' });
  await pocketbasePushSubscriptions.upsert(req.userId, randomUUID(), subscription);

  // Auto-create a web_push integration row if one doesn't exist yet
  const existing = await pocketbaseUserIntegrations.findByType(req.userId, 'web_push');
  if (!existing) {
    await pocketbaseUserIntegrations.create(req.userId, {
      id: randomUUID(),
      type: 'web_push',
      label: 'Browser Push',
      enabled: true,
    });
  }

  res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/subscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  pocketbasePushSubscriptions.deleteByEndpoint(req.userId, endpoint).then(() => {
    res.status(204).end();
  }).catch(err => {
    console.error('deletePushSubscription failed:', err.message);
    res.status(500).json({ error: 'Could not remove push subscription.' });
  });
});

router.post('/expo-token', async (req, res, next) => {
  try {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });

  // Upsert expo_push integration with the new token
  const existing = await pocketbaseUserIntegrations.findByType(req.userId, 'expo_push');
  if (existing) {
    await pocketbaseUserIntegrations.update(req.userId, existing.id, { push_token: token, enabled: true });
  } else {
    await pocketbaseUserIntegrations.create(req.userId, {
      id: randomUUID(),
      type: 'expo_push',
      label: 'Mobile Push',
      push_token: token,
      enabled: true,
    });
  }

  res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { userIntegrations, notificationSchedules } from '../db/queries.js';
import { dispatchDiscordWebhook, dispatchSlackWebhook, dispatchGenericWebhook, dispatchWebPush, dispatchExpoPush } from '../services/notificationService.js';

const router = Router();
router.use(requireAuth);

const VALID_TYPES = ['discord_webhook', 'slack_webhook', 'generic_webhook', 'web_push', 'expo_push'];

// ── Integrations CRUD ─────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  res.json(userIntegrations.getAll(req.userId));
});

router.post('/', (req, res) => {
  const { type, label, endpoint_url, push_token, include_hints, enabled } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const integration = { id: randomUUID(), type, label, endpoint_url, push_token, include_hints, enabled };
  userIntegrations.create(req.userId, integration);
  res.status(201).json(userIntegrations.getById(req.userId, integration.id));
});

router.put('/:id', (req, res) => {
  const { label, endpoint_url, push_token, include_hints, enabled } = req.body;
  userIntegrations.update(req.userId, req.params.id, { label, endpoint_url, push_token, include_hints, enabled });
  const updated = userIntegrations.getById(req.userId, req.params.id);
  if (!updated) return res.status(404).json({ error: 'Integration not found' });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  userIntegrations.delete(req.userId, req.params.id);
  res.status(204).end();
});

// ── Test fire ─────────────────────────────────────────────────────────────────

router.post('/:id/test', async (req, res) => {
  const integration = userIntegrations.getById(req.userId, req.params.id);
  if (!integration) return res.status(404).json({ error: 'Integration not found' });
  const title = 'PLS Calendar — Test Notification';
  const body  = 'Your integration is working correctly!';
  try {
    if (integration.type === 'discord_webhook' && integration.endpoint_url) {
      await dispatchDiscordWebhook(integration.endpoint_url, title, body);
    } else if (integration.type === 'slack_webhook' && integration.endpoint_url) {
      await dispatchSlackWebhook(integration.endpoint_url, title, body);
    } else if (integration.type === 'generic_webhook' && integration.endpoint_url) {
      await dispatchGenericWebhook(integration.endpoint_url, { title, body, test: true });
    } else if (integration.type === 'web_push') {
      await dispatchWebPush(req.userId, title, body);
    } else if (integration.type === 'expo_push' && integration.push_token) {
      await dispatchExpoPush(integration.push_token, title, body);
    } else {
      return res.status(400).json({ error: 'Integration is missing required configuration (endpoint_url or push_token)' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── Notification Schedules ────────────────────────────────────────────────────

router.get('/schedules', (req, res) => {
  res.json(notificationSchedules.getAll(req.userId));
});

router.post('/schedules', (req, res) => {
  const { integration_id, trigger_type, offset_minutes, time_of_day, days_of_week, enabled } = req.body;
  const VALID_TRIGGERS = ['event_reminder', 'habit_reminder', 'daily_summary', 'streak_milestone'];
  if (!trigger_type || !VALID_TRIGGERS.includes(trigger_type)) {
    return res.status(400).json({ error: `trigger_type must be one of: ${VALID_TRIGGERS.join(', ')}` });
  }
  const sched = { id: randomUUID(), integration_id, trigger_type, offset_minutes, time_of_day, days_of_week, enabled };
  notificationSchedules.create(req.userId, sched);
  res.status(201).json(sched);
});

router.put('/schedules/:id', (req, res) => {
  notificationSchedules.update(req.userId, req.params.id, req.body);
  res.json({ ok: true });
});

router.delete('/schedules/:id', (req, res) => {
  notificationSchedules.delete(req.userId, req.params.id);
  res.status(204).end();
});

export default router;

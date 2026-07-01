import { Router } from 'express';
import { randomUUID } from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { pocketbaseNotificationSchedules, pocketbaseUserIntegrations } from '../lib/pocketbaseNotifications.js';
import { dispatchWebhook, discordPayload, slackPayload, dispatchWebPush, dispatchExpoPush } from '../services/notificationService.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const VALID_TYPES = ['discord_webhook', 'slack_webhook', 'generic_webhook', 'web_push', 'expo_push'];

// ── Integrations CRUD ─────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pocketbaseUserIntegrations.getAll(req.userId));
}));

router.post('/', asyncHandler(async (req, res) => {
  const { type, label, endpoint_url, push_token, include_hints, enabled } = req.body;
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
  }
  const integration = { id: randomUUID(), type, label, endpoint_url, push_token, include_hints, enabled };
  const created = await pocketbaseUserIntegrations.create(req.userId, integration);
  res.status(201).json(created);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const { label, endpoint_url, push_token, include_hints, enabled } = req.body;
  const updated = await pocketbaseUserIntegrations.update(req.userId, req.params.id, { label, endpoint_url, push_token, include_hints, enabled });
  if (!updated) return res.status(404).json({ error: 'Integration not found' });
  res.json(updated);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await pocketbaseUserIntegrations.delete(req.userId, req.params.id);
  res.status(204).end();
}));

// ── Test fire ─────────────────────────────────────────────────────────────────

router.post('/:id/test', asyncHandler(async (req, res) => {
  const integration = await pocketbaseUserIntegrations.getById(req.userId, req.params.id);
  if (!integration) return res.status(404).json({ error: 'Integration not found' });
  const title = 'PLS Calendar — Test Notification';
  const body  = 'Your integration is working correctly!';
  try {
    if (integration.type === 'discord_webhook' && integration.endpoint_url) {
      await dispatchWebhook(integration.endpoint_url, discordPayload(title, body), 'Discord');
    } else if (integration.type === 'slack_webhook' && integration.endpoint_url) {
      await dispatchWebhook(integration.endpoint_url, slackPayload(title, body), 'Slack');
    } else if (integration.type === 'generic_webhook' && integration.endpoint_url) {
      await dispatchWebhook(integration.endpoint_url, { title, body, test: true }, 'Generic');
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
}));

// ── Notification Schedules ────────────────────────────────────────────────────

router.get('/schedules', asyncHandler(async (req, res) => {
  res.json(await pocketbaseNotificationSchedules.getAll(req.userId));
}));

router.post('/schedules', asyncHandler(async (req, res) => {
  const { integration_id, trigger_type, offset_minutes, time_of_day, days_of_week, enabled } = req.body;
  const VALID_TRIGGERS = ['event_reminder', 'habit_reminder', 'daily_summary', 'streak_milestone'];
  if (!trigger_type || !VALID_TRIGGERS.includes(trigger_type)) {
    return res.status(400).json({ error: `trigger_type must be one of: ${VALID_TRIGGERS.join(', ')}` });
  }
  const sched = { id: randomUUID(), integration_id, trigger_type, offset_minutes, time_of_day, days_of_week, enabled };
  const created = await pocketbaseNotificationSchedules.create(req.userId, sched);
  res.status(201).json(created);
}));

router.put('/schedules/:id', asyncHandler(async (req, res) => {
  const updated = await pocketbaseNotificationSchedules.update(req.userId, req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Schedule not found' });
  res.json(updated);
}));

router.delete('/schedules/:id', asyncHandler(async (req, res) => {
  await pocketbaseNotificationSchedules.delete(req.userId, req.params.id);
  res.status(204).end();
}));

export default router;

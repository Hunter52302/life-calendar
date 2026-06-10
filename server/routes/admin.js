/**
 * Admin panel API. Deliberately minimal by design (zero-trust model):
 * admins can see only account emails and metadata — never calendar
 * content, profile fields, or encryption keys.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { users } from '../db/queries.js';

const router = Router();
router.use(requireAuth, requireAdmin);

/** GET /api/admin/users — list accounts (email + status only). */
router.get('/users', (req, res) => {
  res.json(users.listAll());
});

/**
 * POST /api/admin/users/:id/reset-password
 * Body: { newPassword: string }
 * Note: for ZK-enabled accounts the user's data stays encrypted under
 * their old password — they'll be prompted for it to unlock after login.
 */
router.post('/users/:id/reset-password', async (req, res) => {
  const target = users.getById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const { newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const hash = await bcrypt.hash(newPassword, 12);
  users.setPassword(target.id, hash);
  res.json({ ok: true, zk_enabled: target.zk_enabled === 1 });
});

/**
 * PUT /api/admin/users/:id/block
 * Body: { blocked: boolean }
 */
router.put('/users/:id/block', (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'You cannot block your own account.' });
  }
  const target = users.getById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  users.setBlocked(target.id, !!req.body?.blocked);
  res.json({ ok: true });
});

/** DELETE /api/admin/users/:id — removes the account and all its data (FK cascade). */
router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.userId) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const target = users.getById(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  users.deleteUser(target.id);
  res.json({ ok: true });
});

export default router;

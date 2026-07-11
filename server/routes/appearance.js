import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pbUserAppearance } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pbUserAppearance.get(req.userId));
}));

// The body is the client's appearance object (background image + visual
// controls). It's stored verbatim as a JSON blob; with zero-knowledge sync the
// image field is already ciphertext by the time it reaches us.
router.put('/', asyncHandler(async (req, res) => {
  await pbUserAppearance.set(req.userId, req.body ?? {});
  res.json({ ok: true });
}));

export default router;

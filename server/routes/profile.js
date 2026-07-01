import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pbUserProfile } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pbUserProfile.get(req.userId));
}));

router.put('/', asyncHandler(async (req, res) => {
  const { username, displayName, email, phones, birthday, homeAddress, otherAddresses } = req.body;
  await pbUserProfile.set(req.userId, {
    username:       username       ?? null,
    displayName:    displayName    ?? null,
    email:          email          ?? null,
    phones:         phones         ?? [],
    birthday:       birthday       ?? null,
    homeAddress:    homeAddress    ?? null,
    otherAddresses: otherAddresses ?? [],
  });
  res.json({ ok: true });
}));

export default router;

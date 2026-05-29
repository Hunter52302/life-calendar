import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { userProfile } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(userProfile.get(req.userId));
});

router.put('/', (req, res) => {
  const { username, displayName, email, phones, birthday, homeAddress, otherAddresses } = req.body;
  userProfile.set(req.userId, {
    username:       username       ?? null,
    displayName:    displayName    ?? null,
    email:          email          ?? null,
    phones:         phones         ?? [],
    birthday:       birthday       ?? null,
    homeAddress:    homeAddress    ?? null,
    otherAddresses: otherAddresses ?? [],
  });
  res.json({ ok: true });
});

export default router;

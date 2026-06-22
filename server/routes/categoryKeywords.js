import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { categoryKeywords } from '../db/queries.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json(categoryKeywords.getAll(req.userId));
});

export default router;

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pbCategoryKeywords } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await pbCategoryKeywords.getAll(req.userId));
}));

export default router;

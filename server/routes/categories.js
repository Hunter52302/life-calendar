import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { pbCategoryOverrides, pbCustomCategories, pbDeletedDefaults } from '../lib/pocketbaseSupport.js';

const router = Router();
router.use(requireAuth);
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/**
 * GET /api/categories
 * Returns everything the frontend needs to reconstruct category state:
 *   { customCategories, categoryOverrides, deletedDefaultIds }
 */
router.get('/', asyncHandler(async (req, res) => {
  const [customCategories, categoryOverrides, deletedDefaultIds] = await Promise.all([
    pbCustomCategories.getAll(req.userId),
    pbCategoryOverrides.getAll(req.userId),
    pbDeletedDefaults.getAll(req.userId),
  ]);
  res.json({ customCategories, categoryOverrides, deletedDefaultIds });
}));

// POST /api/categories — create a custom category
router.post('/', asyncHandler(async (req, res) => {
  const cat = await pbCustomCategories.create(req.userId, req.body);
  res.status(201).json(cat);
}));

/**
 * PUT /api/categories/:id
 * Updates a category override (works for both custom and default categories).
 * Body: { label?, color? }
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const isCustom = await pbCustomCategories.exists(req.userId, req.params.id);
  if (isCustom) {
    const updated = await pbCustomCategories.update(req.userId, req.params.id, req.body);
    return res.json(updated ?? { ok: true });
  }
  await pbCategoryOverrides.set(req.userId, req.params.id, req.body);
  res.json({ ok: true });
}));

/**
 * DELETE /api/categories/:id
 * Deletes a custom category AND records it as a deleted default
 * (so default categories can also be hidden).
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  await pbCustomCategories.delete(req.userId, req.params.id);
  await pbDeletedDefaults.add(req.userId, req.params.id);
  res.json({ ok: true });
}));

export default router;

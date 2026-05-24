import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  customCategories,
  categoryOverrides,
  deletedDefaults,
} from '../db/queries.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/categories
 * Returns everything the frontend needs to reconstruct category state:
 *   { customCategories, categoryOverrides, deletedDefaultIds }
 */
router.get('/', (req, res) => {
  res.json({
    customCategories: customCategories.getAll(req.userId),
    categoryOverrides: categoryOverrides.getAll(req.userId),
    deletedDefaultIds: deletedDefaults.getAll(req.userId),
  });
});

// POST /api/categories — create a custom category
router.post('/', (req, res) => {
  const cat = customCategories.create(req.userId, req.body);
  res.status(201).json(cat);
});

/**
 * PUT /api/categories/:id
 * Updates a category override (works for both custom and default categories).
 * Body: { label?, color? }
 */
router.put('/:id', (req, res) => {
  categoryOverrides.set(req.userId, req.params.id, req.body);
  res.json({ ok: true });
});

/**
 * DELETE /api/categories/:id
 * Deletes a custom category AND records it as a deleted default
 * (so default categories can also be hidden).
 */
router.delete('/:id', (req, res) => {
  customCategories.delete(req.userId, req.params.id);
  deletedDefaults.add(req.userId, req.params.id);
  res.json({ ok: true });
});

export default router;

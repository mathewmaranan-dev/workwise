import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

// GET /api/lookups/categories
router.get('/categories', async (req, res) => {
  try {
    const result = await query('SELECT category_id, category_name FROM category ORDER BY category_id');
    return res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch categories:', (error as any)?.stack || error);
    return res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Optionally expose subcategories
router.get('/subcategories', async (req, res) => {
  try {
    const result = await query('SELECT subcategory_id, subcategory_name, category_id FROM subcategory ORDER BY subcategory_id');
    return res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch subcategories:', (error as any)?.stack || error);
    return res.status(500).json({ error: 'Failed to fetch subcategories' });
  }
});

router.get('/statuses', async (req, res) => {
  try {
    const result = await query('SELECT status_id, status_name FROM status ORDER BY status_id');
    return res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch statuses:', (error as any)?.stack || error);
    return res.status(500).json({ error: 'Failed to fetch statuses' });
  }
});

router.get('/priorities', async (req, res) => {
  try {
    const result = await query('SELECT priority_id, priority_level FROM priority ORDER BY priority_id');
    return res.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch priorities:', (error as any)?.stack || error);
    return res.status(500).json({ error: 'Failed to fetch priorities' });
  }
});

export default router;

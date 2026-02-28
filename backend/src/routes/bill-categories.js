import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// List all categories with bill counts and latest amounts
router.get('/', (req, res) => {
  const categories = db.prepare('SELECT * FROM bill_categories ORDER BY name').all();

  const enriched = categories.map(cat => {
    const stats = db.prepare(`
      SELECT COUNT(*) as bill_count,
        SUM(amount) as total_spent,
        AVG(amount) as avg_amount,
        MAX(bill_date) as latest_date
      FROM bills WHERE category_id = ?
    `).get(cat.id);

    const unpaidCount = db.prepare(
      'SELECT COUNT(*) as count FROM bills WHERE category_id = ? AND paid = 0'
    ).get(cat.id);

    const latestBill = db.prepare(
      'SELECT amount, bill_date FROM bills WHERE category_id = ? ORDER BY bill_date DESC LIMIT 1'
    ).get(cat.id);

    return {
      ...cat,
      custom_fields: JSON.parse(cat.custom_fields || '[]'),
      bill_count: stats.bill_count,
      total_spent: Math.round((stats.total_spent || 0) * 100) / 100,
      avg_amount: Math.round((stats.avg_amount || 0) * 100) / 100,
      latest_date: stats.latest_date,
      latest_amount: latestBill ? latestBill.amount : null,
      unpaid_count: unpaidCount.count,
    };
  });

  res.json(enriched);
});

// Get single category
router.get('/:id', (req, res) => {
  const cat = db.prepare('SELECT * FROM bill_categories WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ error: 'Category not found' });
  cat.custom_fields = JSON.parse(cat.custom_fields || '[]');
  res.json(cat);
});

// Create category
router.post('/', (req, res) => {
  const { name, icon, color, usage_unit, usage_label, cycle, custom_fields, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO bill_categories (name, icon, color, usage_unit, usage_label, cycle, custom_fields, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, icon || '💡', color || 'var(--color-gold)',
    usage_unit || null, usage_label || null,
    cycle || 'monthly',
    JSON.stringify(custom_fields || []),
    notes || null
  );

  const cat = db.prepare('SELECT * FROM bill_categories WHERE id = ?').get(result.lastInsertRowid);
  cat.custom_fields = JSON.parse(cat.custom_fields || '[]');
  res.status(201).json(cat);
});

// Update category
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bill_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const { name, icon, color, usage_unit, usage_label, cycle, custom_fields, notes } = req.body;

  db.prepare(`
    UPDATE bill_categories SET name=?, icon=?, color=?, usage_unit=?, usage_label=?,
      cycle=?, custom_fields=?, notes=?
    WHERE id=?
  `).run(
    name ?? existing.name,
    icon ?? existing.icon,
    color ?? existing.color,
    usage_unit !== undefined ? usage_unit : existing.usage_unit,
    usage_label !== undefined ? usage_label : existing.usage_label,
    cycle ?? existing.cycle,
    custom_fields ? JSON.stringify(custom_fields) : existing.custom_fields,
    notes !== undefined ? notes : existing.notes,
    req.params.id
  );

  const cat = db.prepare('SELECT * FROM bill_categories WHERE id = ?').get(req.params.id);
  cat.custom_fields = JSON.parse(cat.custom_fields || '[]');
  res.json(cat);
});

// Delete category (cascades to bills)
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bill_categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });
  db.prepare('DELETE FROM bill_categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { forecastBill, calcYoY, monthlyAggregates } from '../services/forecasting.js';

const router = Router();
router.use(auth);

// List bills for a category (with optional year filter)
router.get('/category/:categoryId', (req, res) => {
  const { year } = req.query;
  let query = 'SELECT * FROM bills WHERE category_id = ?';
  const params = [req.params.categoryId];

  if (year) {
    query += " AND bill_date LIKE ?";
    params.push(`${year}-%`);
  }

  query += ' ORDER BY bill_date DESC';
  const bills = db.prepare(query).all(...params);

  // Parse custom_data
  const parsed = bills.map(b => ({
    ...b,
    custom_data: JSON.parse(b.custom_data || '{}'),
  }));

  res.json(parsed);
});

// Get single bill
router.get('/:id', (req, res) => {
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  bill.custom_data = JSON.parse(bill.custom_data || '{}');
  res.json(bill);
});

// Create bill
router.post('/', (req, res) => {
  const { category_id, bill_date, due_date, amount, usage_amount, paid, paid_date, custom_data, notes } = req.body;

  if (!category_id || !bill_date || amount === undefined) {
    return res.status(400).json({ error: 'category_id, bill_date, and amount are required' });
  }

  const result = db.prepare(`
    INSERT INTO bills (category_id, bill_date, due_date, amount, usage_amount, paid, paid_date, custom_data, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category_id, bill_date, due_date || null,
    amount, usage_amount || null,
    paid ? 1 : 0, paid_date || null,
    JSON.stringify(custom_data || {}),
    notes || null
  );

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(result.lastInsertRowid);
  bill.custom_data = JSON.parse(bill.custom_data || '{}');
  res.status(201).json(bill);
});

// Update bill
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bill not found' });

  const { bill_date, due_date, amount, usage_amount, paid, paid_date, custom_data, notes } = req.body;

  db.prepare(`
    UPDATE bills SET bill_date=?, due_date=?, amount=?, usage_amount=?,
      paid=?, paid_date=?, custom_data=?, notes=?
    WHERE id=?
  `).run(
    bill_date ?? existing.bill_date,
    due_date !== undefined ? due_date : existing.due_date,
    amount ?? existing.amount,
    usage_amount !== undefined ? usage_amount : existing.usage_amount,
    paid !== undefined ? (paid ? 1 : 0) : existing.paid,
    paid_date !== undefined ? paid_date : existing.paid_date,
    custom_data ? JSON.stringify(custom_data) : existing.custom_data,
    notes !== undefined ? notes : existing.notes,
    req.params.id
  );

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  bill.custom_data = JSON.parse(bill.custom_data || '{}');
  res.json(bill);
});

// Toggle paid status
router.patch('/:id/toggle-paid', (req, res) => {
  const existing = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bill not found' });

  const newPaid = existing.paid ? 0 : 1;
  const paidDate = newPaid ? new Date().toISOString().split('T')[0] : null;

  db.prepare('UPDATE bills SET paid = ?, paid_date = ? WHERE id = ?').run(newPaid, paidDate, req.params.id);

  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  bill.custom_data = JSON.parse(bill.custom_data || '{}');
  res.json(bill);
});

// Delete bill
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM bills WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Bill not found' });
  db.prepare('DELETE FROM bills WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Analytics for a category
router.get('/category/:categoryId/analytics', (req, res) => {
  const cat = db.prepare('SELECT * FROM bill_categories WHERE id = ?').get(req.params.categoryId);
  if (!cat) return res.status(404).json({ error: 'Category not found' });

  const allBills = db.prepare(
    'SELECT * FROM bills WHERE category_id = ? ORDER BY bill_date ASC'
  ).all(req.params.categoryId);

  const forecast = forecastBill(allBills);
  const yoy = calcYoY(allBills);
  const monthly = monthlyAggregates(allBills, 12);

  res.json({
    category: {
      ...cat,
      custom_fields: JSON.parse(cat.custom_fields || '[]'),
    },
    forecast,
    yoy,
    monthly,
    total_bills: allBills.length,
  });
});

// Dashboard summary across all categories
router.get('/dashboard/summary', (req, res) => {
  const categories = db.prepare('SELECT * FROM bill_categories ORDER BY name').all();

  let totalMonthlyEstimate = 0;
  let totalUnpaid = 0;
  let totalThisMonth = 0;

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const categorySummaries = categories.map(cat => {
    const allBills = db.prepare(
      'SELECT * FROM bills WHERE category_id = ? ORDER BY bill_date ASC'
    ).all(cat.id);

    const unpaid = db.prepare(
      'SELECT COUNT(*) as count, SUM(amount) as total FROM bills WHERE category_id = ? AND paid = 0'
    ).get(cat.id);

    const thisMonthBills = allBills.filter(b => b.bill_date.startsWith(thisMonth));
    const thisMonthTotal = thisMonthBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

    const forecast = forecastBill(allBills);

    totalMonthlyEstimate += forecast.forecast;
    totalUnpaid += parseFloat(unpaid.total) || 0;
    totalThisMonth += thisMonthTotal;

    return {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      cycle: cat.cycle,
      forecast: forecast.forecast,
      trend: forecast.trend,
      unpaid_count: unpaid.count,
      unpaid_total: Math.round((parseFloat(unpaid.total) || 0) * 100) / 100,
      this_month: Math.round(thisMonthTotal * 100) / 100,
    };
  });

  res.json({
    categories: categorySummaries,
    totals: {
      monthly_estimate: Math.round(totalMonthlyEstimate * 100) / 100,
      unpaid_total: Math.round(totalUnpaid * 100) / 100,
      this_month: Math.round(totalThisMonth * 100) / 100,
      category_count: categories.length,
    },
  });
});

export default router;

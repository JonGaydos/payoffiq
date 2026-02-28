import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// GET /api/calendar?month=YYYY-MM — aggregated events from all modules
router.get('/', (req, res) => {
  const { month } = req.query;
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = targetMonth.split('-').map(Number);

  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
  const endDate = mon === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(mon + 1).padStart(2, '0')}-01`;

  const events = [];

  // Custom calendar events
  const custom = db.prepare(`
    SELECT * FROM calendar_events
    WHERE event_date >= ? AND event_date < ?
    ORDER BY event_date
  `).all(startDate, endDate);

  custom.forEach(e => events.push({
    id: `cal_${e.id}`,
    title: e.title,
    date: e.event_date,
    type: 'custom',
    color: e.color || 'var(--color-gold)',
    notes: e.notes,
  }));

  // Bill due dates
  try {
    const bills = db.prepare(`
      SELECT b.*, bc.name as category_name, bc.icon
      FROM bills b
      JOIN bill_categories bc ON b.category_id = bc.id
      WHERE b.due_date >= ? AND b.due_date < ?
      ORDER BY b.due_date
    `).all(startDate, endDate);

    bills.forEach(b => events.push({
      id: `bill_${b.id}`,
      title: `${b.icon || '\u{1F4A1}'} ${b.category_name}`,
      date: b.due_date,
      type: 'bill',
      color: b.paid ? 'var(--color-sage)' : 'var(--color-terracotta)',
      amount: b.amount,
      paid: !!b.paid,
    }));
  } catch { /* bills table may not exist */ }

  // Insurance renewal dates
  try {
    const policies = db.prepare(`
      SELECT * FROM insurance_policies
      WHERE renewal_date >= ? AND renewal_date < ?
    `).all(startDate, endDate);

    policies.forEach(p => events.push({
      id: `ins_${p.id}`,
      title: `\u{1F6E1}\uFE0F ${p.name} Renewal`,
      date: p.renewal_date,
      type: 'insurance',
      color: 'var(--color-gold)',
    }));
  } catch { /* table may not exist */ }

  // Maintenance due dates
  try {
    const tasks = db.prepare(`
      SELECT * FROM maintenance_tasks
      WHERE next_due >= ? AND next_due < ? AND status != 'completed'
    `).all(startDate, endDate);

    tasks.forEach(t => events.push({
      id: `maint_${t.id}`,
      title: `\u{1F527} ${t.name}`,
      date: t.next_due,
      type: 'maintenance',
      color: t.priority === 'high' ? 'var(--color-danger)' : 'var(--color-warm-gray)',
    }));
  } catch { /* table may not exist */ }

  // Loan payments
  try {
    const payments = db.prepare(`
      SELECT p.*, l.name as loan_name
      FROM payments p
      JOIN loans l ON p.loan_id = l.id
      WHERE p.payment_date >= ? AND p.payment_date < ?
      ORDER BY p.payment_date
    `).all(startDate, endDate);

    payments.forEach(p => events.push({
      id: `pmt_${p.id}`,
      title: `\u{1F4B5} ${p.loan_name} Payment`,
      date: p.payment_date,
      type: 'payment',
      color: 'var(--color-sage)',
      amount: p.total_payment,
    }));
  } catch { /* table may not exist */ }

  // Credit card snapshots (payments made)
  try {
    const snapshots = db.prepare(`
      SELECT s.*, c.name as card_name
      FROM credit_card_snapshots s
      JOIN credit_cards c ON s.card_id = c.id
      WHERE s.snapshot_date >= ? AND s.snapshot_date < ? AND s.payment_made > 0
      ORDER BY s.snapshot_date
    `).all(startDate, endDate);

    snapshots.forEach(s => events.push({
      id: `ccpmt_${s.id}`,
      title: `\u{1F4B3} ${s.card_name} Payment`,
      date: s.snapshot_date,
      type: 'cc_payment',
      color: 'var(--color-gold)',
      amount: s.payment_made,
    }));
  } catch { /* table may not exist */ }

  // Insurance payments
  try {
    const insPmts = db.prepare(`
      SELECT ip.*, ins.name as policy_name
      FROM insurance_payments ip
      JOIN insurance_policies ins ON ip.policy_id = ins.id
      WHERE ip.payment_date >= ? AND ip.payment_date < ?
      ORDER BY ip.payment_date
    `).all(startDate, endDate);

    insPmts.forEach(p => events.push({
      id: `inspmt_${p.id}`,
      title: `\u{1F6E1}\uFE0F ${p.policy_name} Premium`,
      date: p.payment_date,
      type: 'insurance_payment',
      color: 'var(--color-gold)',
      amount: p.amount,
    }));
  } catch { /* table may not exist */ }

  // Sort all events by date
  events.sort((a, b) => a.date.localeCompare(b.date));

  res.json({ month: targetMonth, events });
});

// POST /api/calendar — create custom event
router.post('/', (req, res) => {
  const { title, event_date, color, notes } = req.body;
  if (!title || !event_date) return res.status(400).json({ error: 'Title and date required' });

  const result = db.prepare(`
    INSERT INTO calendar_events (title, event_date, color, notes)
    VALUES (?, ?, ?, ?)
  `).run(title, event_date, color || null, notes || null);

  res.json({ id: result.lastInsertRowid });
});

// DELETE /api/calendar/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// List all loans
router.get('/', (req, res) => {
  const loans = db.prepare('SELECT * FROM loans ORDER BY created_at DESC').all();
  res.json(loans);
});

// Get single loan
router.get('/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  res.json(loan);
});

// Create loan
router.post('/', (req, res) => {
  const { name, loan_type, original_amount, interest_rate, loan_term_months, start_date,
    monthly_payment, current_balance, estimated_value, currency,
    arm_fixed_months, arm_rate_cap, arm_rate_floor, arm_periodic_cap, arm_initial_cap } = req.body;

  if (!name || !original_amount || !interest_rate || !loan_term_months || !start_date || !monthly_payment) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Handle empty string for current_balance — treat '' and null/undefined as "use original_amount"
  const effectiveBalance = (current_balance === '' || current_balance == null) ? original_amount : current_balance;

  const result = db.prepare(`
    INSERT INTO loans (name, loan_type, original_amount, interest_rate, loan_term_months,
      start_date, monthly_payment, current_balance, estimated_value, currency,
      arm_fixed_months, arm_rate_cap, arm_rate_floor, arm_periodic_cap, arm_initial_cap)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, loan_type || 'mortgage', original_amount, interest_rate, loan_term_months,
    start_date, monthly_payment, effectiveBalance, estimated_value || null,
    currency || 'USD', arm_fixed_months || null, arm_rate_cap || null,
    arm_rate_floor || null, arm_periodic_cap || null, arm_initial_cap || null
  );

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(loan);
});

// Update loan
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Loan not found' });

  const { name, loan_type, original_amount, interest_rate, loan_term_months, start_date,
    monthly_payment, current_balance, estimated_value, currency,
    arm_fixed_months, arm_rate_cap, arm_rate_floor, arm_periodic_cap, arm_initial_cap } = req.body;

  // Handle empty string for current_balance
  const effectiveBalance = (current_balance === '' || current_balance == null)
    ? existing.current_balance
    : current_balance;

  db.prepare(`
    UPDATE loans SET name=?, loan_type=?, original_amount=?, interest_rate=?, loan_term_months=?,
      start_date=?, monthly_payment=?, current_balance=?, estimated_value=?, currency=?,
      arm_fixed_months=?, arm_rate_cap=?, arm_rate_floor=?, arm_periodic_cap=?, arm_initial_cap=?
    WHERE id=?
  `).run(
    name ?? existing.name, loan_type ?? existing.loan_type,
    original_amount ?? existing.original_amount, interest_rate ?? existing.interest_rate,
    loan_term_months ?? existing.loan_term_months, start_date ?? existing.start_date,
    monthly_payment ?? existing.monthly_payment, effectiveBalance,
    estimated_value ?? existing.estimated_value, currency ?? existing.currency,
    arm_fixed_months ?? existing.arm_fixed_months, arm_rate_cap ?? existing.arm_rate_cap,
    arm_rate_floor ?? existing.arm_rate_floor, arm_periodic_cap ?? existing.arm_periodic_cap,
    arm_initial_cap ?? existing.arm_initial_cap,
    req.params.id
  );

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  res.json(loan);
});

// Delete loan
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Loan not found' });
  db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Get latest balance for a loan
router.get('/:id/latest-balance', (req, res) => {
  const payment = db.prepare(
    'SELECT ending_balance FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
  ).get(req.params.id);

  if (payment) {
    res.json({ balance: payment.ending_balance });
  } else {
    const loan = db.prepare('SELECT current_balance, original_amount FROM loans WHERE id = ?').get(req.params.id);
    res.json({ balance: loan ? (loan.current_balance ?? loan.original_amount) : 0 });
  }
});

export default router;

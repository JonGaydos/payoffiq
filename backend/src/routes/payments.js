import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Get payments for a loan
router.get('/loan/:loanId', (req, res) => {
  const payments = db.prepare(
    'SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date ASC, id ASC'
  ).all(req.params.loanId);
  res.json(payments);
});

// Create payment
router.post('/loan/:loanId', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.loanId);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  const { payment_date, total_payment, principal, interest, escrow,
    extra_principal, ending_balance, statement_month, notes } = req.body;

  if (!payment_date) return res.status(400).json({ error: 'Payment date required' });

  // Auto-calculate ending balance if not provided
  let calcBalance = ending_balance;
  if (calcBalance == null) {
    const prevPayment = db.prepare(
      'SELECT ending_balance FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
    ).get(req.params.loanId);
    const prevBalance = prevPayment ? prevPayment.ending_balance : (loan.current_balance ?? loan.original_amount);
    const principalPaid = (parseFloat(principal) || 0) + (parseFloat(extra_principal) || 0);
    calcBalance = Math.max(0, (parseFloat(prevBalance) || 0) - principalPaid);
  }

  const result = db.prepare(`
    INSERT INTO payments (loan_id, payment_date, total_payment, principal, interest,
      escrow, extra_principal, ending_balance, statement_month, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.loanId, payment_date, parseFloat(total_payment) || 0,
    parseFloat(principal) || 0, parseFloat(interest) || 0,
    parseFloat(escrow) || 0, parseFloat(extra_principal) || 0,
    calcBalance, statement_month || null, notes || null
  );

  // Update loan current_balance
  db.prepare('UPDATE loans SET current_balance = ? WHERE id = ?').run(calcBalance, req.params.loanId);

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(payment);
});

// Update payment
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });

  const { payment_date, total_payment, principal, interest, escrow,
    extra_principal, ending_balance, statement_month, notes } = req.body;

  // Auto-calculate ending balance if not provided
  let calcBalance = ending_balance;
  if (calcBalance == null) {
    const prevPayment = db.prepare(
      'SELECT ending_balance FROM payments WHERE loan_id = ? AND (payment_date < ? OR (payment_date = ? AND id < ?)) ORDER BY payment_date DESC, id DESC LIMIT 1'
    ).get(existing.loan_id, payment_date || existing.payment_date, payment_date || existing.payment_date, existing.id);

    const loan = db.prepare('SELECT current_balance, original_amount FROM loans WHERE id = ?').get(existing.loan_id);
    const prevBalance = prevPayment ? prevPayment.ending_balance : (loan.current_balance ?? loan.original_amount);
    const principalPaid = (parseFloat(principal ?? existing.principal) || 0) + (parseFloat(extra_principal ?? existing.extra_principal) || 0);
    calcBalance = Math.max(0, (parseFloat(prevBalance) || 0) - principalPaid);
  }

  db.prepare(`
    UPDATE payments SET payment_date=?, total_payment=?, principal=?, interest=?,
      escrow=?, extra_principal=?, ending_balance=?, statement_month=?, notes=?
    WHERE id=?
  `).run(
    payment_date ?? existing.payment_date,
    parseFloat(total_payment ?? existing.total_payment) || 0,
    parseFloat(principal ?? existing.principal) || 0,
    parseFloat(interest ?? existing.interest) || 0,
    parseFloat(escrow ?? existing.escrow) || 0,
    parseFloat(extra_principal ?? existing.extra_principal) || 0,
    calcBalance,
    statement_month ?? existing.statement_month,
    notes ?? existing.notes,
    req.params.id
  );

  // Update loan current_balance to latest payment
  const latest = db.prepare(
    'SELECT ending_balance FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
  ).get(existing.loan_id);
  if (latest) {
    db.prepare('UPDATE loans SET current_balance = ? WHERE id = ?').run(latest.ending_balance, existing.loan_id);
  }

  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  res.json(payment);
});

// Delete payment
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Payment not found' });

  db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);

  // Update loan current_balance to latest remaining payment
  const latest = db.prepare(
    'SELECT ending_balance FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
  ).get(existing.loan_id);
  const loan = db.prepare('SELECT original_amount FROM loans WHERE id = ?').get(existing.loan_id);
  const newBalance = latest ? latest.ending_balance : loan.original_amount;
  db.prepare('UPDATE loans SET current_balance = ? WHERE id = ?').run(newBalance, existing.loan_id);

  res.json({ success: true });
});

export default router;

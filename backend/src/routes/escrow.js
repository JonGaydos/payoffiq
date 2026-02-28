import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// === Escrow Items (Disbursements) ===

router.get('/loan/:loanId/items', (req, res) => {
  const items = db.prepare(
    'SELECT * FROM escrow_items WHERE loan_id = ? ORDER BY payment_date DESC'
  ).all(req.params.loanId);
  res.json(items);
});

router.post('/loan/:loanId/items', (req, res) => {
  const { item_type, description, amount, payment_date, year } = req.body;
  if (!item_type || !amount || !payment_date) {
    return res.status(400).json({ error: 'Type, amount, and date required' });
  }

  const result = db.prepare(
    'INSERT INTO escrow_items (loan_id, item_type, description, amount, payment_date, year) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.params.loanId, item_type, description || null, amount, payment_date, year || null);

  const item = db.prepare('SELECT * FROM escrow_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

router.put('/items/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM escrow_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Escrow item not found' });

  const { item_type, description, amount, payment_date, year } = req.body;
  db.prepare(
    'UPDATE escrow_items SET item_type=?, description=?, amount=?, payment_date=?, year=? WHERE id=?'
  ).run(
    item_type ?? existing.item_type, description ?? existing.description,
    amount ?? existing.amount, payment_date ?? existing.payment_date,
    year ?? existing.year, req.params.id
  );

  const item = db.prepare('SELECT * FROM escrow_items WHERE id = ?').get(req.params.id);
  res.json(item);
});

router.delete('/items/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM escrow_items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Escrow item not found' });
  db.prepare('DELETE FROM escrow_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// === Escrow Account Setup ===

router.get('/loan/:loanId/account', (req, res) => {
  const account = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id = ?').get(req.params.loanId);
  res.json(account || { loan_id: parseInt(req.params.loanId), starting_balance: 0, target_balance: 0, monthly_escrow: 0 });
});

router.post('/loan/:loanId/account', (req, res) => {
  const { starting_balance, target_balance, monthly_escrow, notes } = req.body;
  db.prepare(`
    INSERT INTO escrow_accounts (loan_id, starting_balance, target_balance, monthly_escrow, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(loan_id) DO UPDATE SET
      starting_balance=excluded.starting_balance, target_balance=excluded.target_balance,
      monthly_escrow=excluded.monthly_escrow, notes=excluded.notes, updated_at=datetime('now')
  `).run(
    req.params.loanId, parseFloat(starting_balance) || 0,
    parseFloat(target_balance) || 0, parseFloat(monthly_escrow) || 0, notes || null
  );

  const account = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id = ?').get(req.params.loanId);
  res.json(account);
});

// === Escrow Adjustments ===

router.get('/loan/:loanId/adjustments', (req, res) => {
  const adjustments = db.prepare(
    'SELECT * FROM escrow_adjustments WHERE loan_id = ? ORDER BY effective_date DESC'
  ).all(req.params.loanId);
  res.json(adjustments);
});

router.post('/loan/:loanId/adjustments', (req, res) => {
  const { effective_date, new_monthly_escrow, new_target_balance, reason, notes } = req.body;
  if (!effective_date) return res.status(400).json({ error: 'Effective date required' });

  const result = db.prepare(
    'INSERT INTO escrow_adjustments (loan_id, effective_date, new_monthly_escrow, new_target_balance, reason, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    req.params.loanId, effective_date,
    new_monthly_escrow || null, new_target_balance || null,
    reason || null, notes || null
  );

  // Update escrow account with new values
  if (new_monthly_escrow || new_target_balance) {
    const updates = [];
    const params = [];
    if (new_monthly_escrow) { updates.push('monthly_escrow = ?'); params.push(new_monthly_escrow); }
    if (new_target_balance) { updates.push('target_balance = ?'); params.push(new_target_balance); }
    updates.push("updated_at = datetime('now')");
    params.push(req.params.loanId);
    db.prepare(`UPDATE escrow_accounts SET ${updates.join(', ')} WHERE loan_id = ?`).run(...params);
  }

  const adjustment = db.prepare('SELECT * FROM escrow_adjustments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(adjustment);
});

router.delete('/adjustments/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM escrow_adjustments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Adjustment not found' });
  db.prepare('DELETE FROM escrow_adjustments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// === Escrow Running Balance Ledger ===

router.get('/loan/:loanId/balance', (req, res) => {
  const account = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id = ?').get(req.params.loanId);
  const startingBalance = account ? parseFloat(account.starting_balance) || 0 : 0;

  // Get deposits (escrow portion of payments)
  const deposits = db.prepare(
    'SELECT id, payment_date as date, escrow as amount FROM payments WHERE loan_id = ? AND escrow > 0'
  ).all(req.params.loanId).map(d => ({ ...d, type: 'deposit', description: 'Monthly escrow payment' }));

  // Get disbursements
  const disbursements = db.prepare(
    'SELECT id, payment_date as date, amount, item_type, description FROM escrow_items WHERE loan_id = ?'
  ).all(req.params.loanId).map(d => ({ ...d, type: 'disbursement', amount: -Math.abs(d.amount) }));

  // Merge and sort chronologically
  const events = [...deposits, ...disbursements].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.type === 'deposit' ? -1 : 1;
  });

  let runningBalance = startingBalance;
  const ledger = events.map(event => {
    runningBalance += parseFloat(event.amount) || 0;
    return {
      ...event,
      running_balance: Math.round(runningBalance * 100) / 100
    };
  });

  const totalDeposits = deposits.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);
  const totalDisbursements = disbursements.reduce((sum, d) => sum + Math.abs(parseFloat(d.amount) || 0), 0);

  res.json({
    starting_balance: startingBalance,
    current_balance: Math.round(runningBalance * 100) / 100,
    total_deposits: Math.round(totalDeposits * 100) / 100,
    total_disbursements: Math.round(totalDisbursements * 100) / 100,
    target_balance: account ? parseFloat(account.target_balance) || 0 : 0,
    monthly_escrow: account ? parseFloat(account.monthly_escrow) || 0 : 0,
    ledger
  });
});

export default router;

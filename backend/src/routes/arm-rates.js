import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// Get ARM rate history for a loan
router.get('/loan/:loanId', (req, res) => {
  const rates = db.prepare(
    'SELECT * FROM arm_rate_history WHERE loan_id = ? ORDER BY effective_date ASC'
  ).all(req.params.loanId);
  res.json(rates);
});

// Add ARM rate entry
router.post('/loan/:loanId', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.loanId);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  if (loan.loan_type !== 'arm') return res.status(400).json({ error: 'Loan is not an ARM' });

  const { effective_date, rate, notes } = req.body;
  if (!effective_date || rate == null) return res.status(400).json({ error: 'Date and rate required' });

  const result = db.prepare(
    'INSERT INTO arm_rate_history (loan_id, effective_date, rate, notes) VALUES (?, ?, ?, ?)'
  ).run(req.params.loanId, effective_date, rate, notes || null);

  // Update the loan's interest_rate to the latest rate
  const latest = db.prepare(
    'SELECT rate FROM arm_rate_history WHERE loan_id = ? ORDER BY effective_date DESC LIMIT 1'
  ).get(req.params.loanId);
  if (latest) {
    db.prepare('UPDATE loans SET interest_rate = ? WHERE id = ?').run(latest.rate, req.params.loanId);
  }

  const entry = db.prepare('SELECT * FROM arm_rate_history WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// Delete ARM rate entry
router.delete('/:id', (req, res) => {
  const entry = db.prepare('SELECT * FROM arm_rate_history WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Rate entry not found' });

  db.prepare('DELETE FROM arm_rate_history WHERE id = ?').run(req.params.id);

  // Update loan interest_rate to latest remaining rate
  const latest = db.prepare(
    'SELECT rate FROM arm_rate_history WHERE loan_id = ? ORDER BY effective_date DESC LIMIT 1'
  ).get(entry.loan_id);
  if (latest) {
    db.prepare('UPDATE loans SET interest_rate = ? WHERE id = ?').run(latest.rate, entry.loan_id);
  }

  res.json({ success: true });
});

export default router;

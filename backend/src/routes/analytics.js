import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { calcPayoff, generateBankSchedule, generateDynamicSchedule } from '../services/amortization.js';

const router = Router();
router.use(auth);

// Per-loan analytics
router.get('/loan/:loanId', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.loanId);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  const payments = db.prepare(
    'SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date ASC, id ASC'
  ).all(req.params.loanId);

  // Aggregates
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.total_payment) || 0), 0);
  const totalPrincipal = payments.reduce((s, p) => s + (parseFloat(p.principal) || 0) + (parseFloat(p.extra_principal) || 0), 0);
  const totalInterest = payments.reduce((s, p) => s + (parseFloat(p.interest) || 0), 0);
  const totalEscrow = payments.reduce((s, p) => s + (parseFloat(p.escrow) || 0), 0);

  // Current balance
  const currentBalance = payments.length > 0
    ? parseFloat(payments[payments.length - 1].ending_balance) || 0
    : parseFloat(loan.current_balance ?? loan.original_amount);

  // Escrow account info
  const escrowAccount = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id = ?').get(req.params.loanId);
  const escrowMonthly = escrowAccount ? parseFloat(escrowAccount.monthly_escrow) || 0 : 0;

  // Payoff projection from current balance
  const payoff = calcPayoff(currentBalance, parseFloat(loan.monthly_payment) - escrowMonthly, parseFloat(loan.interest_rate));

  // Original schedule projection
  const originalPayoff = calcPayoff(
    parseFloat(loan.original_amount),
    parseFloat(loan.monthly_payment) - escrowMonthly,
    parseFloat(loan.interest_rate)
  );

  // Months comparison
  const monthsElapsed = payments.length;
  const monthsAhead = originalPayoff && payoff
    ? (originalPayoff.months - monthsElapsed) - payoff.months
    : 0;

  // Net home equity (for mortgage/ARM types with estimated value)
  const estimatedValue = parseFloat(loan.estimated_value) || 0;
  const netEquity = estimatedValue > 0 ? estimatedValue - currentBalance : null;

  // Amortization schedules
  const bankSchedule = generateBankSchedule(
    parseFloat(loan.original_amount), parseFloat(loan.interest_rate),
    loan.loan_term_months, parseFloat(loan.monthly_payment), escrowMonthly
  );

  const dynamicSchedule = generateDynamicSchedule(
    parseFloat(loan.original_amount), parseFloat(loan.interest_rate),
    parseFloat(loan.monthly_payment), payments, escrowMonthly
  );

  res.json({
    loan,
    summary: {
      total_paid: Math.round(totalPaid * 100) / 100,
      total_principal: Math.round(totalPrincipal * 100) / 100,
      total_interest: Math.round(totalInterest * 100) / 100,
      total_escrow: Math.round(totalEscrow * 100) / 100,
      current_balance: Math.round(currentBalance * 100) / 100,
      payments_made: payments.length,
      months_ahead: monthsAhead,
      net_equity: netEquity != null ? Math.round(netEquity * 100) / 100 : null,
      estimated_value: estimatedValue || null,
    },
    payoff_projection: payoff,
    original_projection: originalPayoff,
    bank_schedule: bankSchedule,
    dynamic_schedule: dynamicSchedule,
  });
});

// Global dashboard
router.get('/dashboard', (req, res) => {
  const loans = db.prepare('SELECT * FROM loans ORDER BY loan_type, name').all();
  const loanSummaries = loans.map(loan => {
    const latestPayment = db.prepare(
      'SELECT ending_balance, payment_date FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
    ).get(loan.id);

    const currentBalance = latestPayment
      ? parseFloat(latestPayment.ending_balance) || 0
      : parseFloat(loan.current_balance ?? loan.original_amount);

    const paymentsAgg = db.prepare(`
      SELECT COUNT(*) as count,
        SUM(total_payment) as total_paid,
        SUM(principal + COALESCE(extra_principal, 0)) as total_principal,
        SUM(interest) as total_interest
      FROM payments WHERE loan_id = ?
    `).get(loan.id);

    return {
      ...loan,
      current_balance: Math.round(currentBalance * 100) / 100,
      payments_made: paymentsAgg.count,
      total_paid: Math.round((paymentsAgg.total_paid || 0) * 100) / 100,
      total_principal: Math.round((paymentsAgg.total_principal || 0) * 100) / 100,
      total_interest: Math.round((paymentsAgg.total_interest || 0) * 100) / 100,
      last_payment_date: latestPayment?.payment_date || null,
    };
  });

  const totalDebt = loanSummaries.reduce((s, l) => s + l.current_balance, 0);
  const totalOriginal = loanSummaries.reduce((s, l) => s + (parseFloat(l.original_amount) || 0), 0);
  const totalPaidDown = totalOriginal - totalDebt;
  const totalEstimatedValue = loanSummaries.reduce((s, l) => s + (parseFloat(l.estimated_value) || 0), 0);

  res.json({
    loans: loanSummaries,
    totals: {
      total_debt: Math.round(totalDebt * 100) / 100,
      total_original: Math.round(totalOriginal * 100) / 100,
      total_paid_down: Math.round(totalPaidDown * 100) / 100,
      total_estimated_value: Math.round(totalEstimatedValue * 100) / 100,
      net_equity: totalEstimatedValue > 0
        ? Math.round((totalEstimatedValue - totalDebt) * 100) / 100
        : null,
      loan_count: loans.length,
    },
  });
});

export default router;

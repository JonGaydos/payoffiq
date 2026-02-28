import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { calcPayoff, findPaymentForTarget } from '../services/amortization.js';

const router = Router();
router.use(auth);

router.post('/loan/:loanId', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.loanId);
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  const escrowAccount = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id = ?').get(req.params.loanId);
  const escrowMonthly = escrowAccount ? parseFloat(escrowAccount.monthly_escrow) || 0 : 0;

  // Get current balance
  const latestPayment = db.prepare(
    'SELECT ending_balance FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
  ).get(req.params.loanId);
  const currentBalance = latestPayment
    ? parseFloat(latestPayment.ending_balance) || 0
    : parseFloat(loan.current_balance ?? loan.original_amount);

  const rate = parseFloat(loan.interest_rate);
  const basePayment = parseFloat(loan.monthly_payment) - escrowMonthly;
  const { extra_monthly, lump_sum, target_months } = req.body;

  const scenarios = {};

  // Base scenario
  const base = calcPayoff(currentBalance, basePayment, rate);
  scenarios.base = base ? {
    ...base,
    monthly_payment: Math.round(basePayment * 100) / 100,
    label: 'Current Payment',
  } : null;

  // Extra monthly payment
  if (extra_monthly && parseFloat(extra_monthly) > 0) {
    const extraPmt = parseFloat(extra_monthly);
    const result = calcPayoff(currentBalance, basePayment + extraPmt, rate);
    if (result && base) {
      scenarios.extra_monthly = {
        ...result,
        monthly_payment: Math.round((basePayment + extraPmt) * 100) / 100,
        extra_amount: extraPmt,
        months_saved: base.months - result.months,
        interest_saved: Math.round((base.totalInterest - result.totalInterest) * 100) / 100,
        label: `+${extraPmt}/mo Extra`,
      };
    }
  }

  // Lump sum payment
  if (lump_sum && parseFloat(lump_sum) > 0) {
    const lumpAmt = Math.min(parseFloat(lump_sum), currentBalance);
    const newBalance = currentBalance - lumpAmt;
    const result = calcPayoff(newBalance, basePayment, rate);
    if (result && base) {
      scenarios.lump_sum = {
        ...result,
        monthly_payment: Math.round(basePayment * 100) / 100,
        lump_amount: lumpAmt,
        months_saved: base.months - result.months,
        interest_saved: Math.round((base.totalInterest - result.totalInterest) * 100) / 100,
        label: `${lumpAmt} Lump Sum`,
      };
    }
  }

  // Combined (lump sum + extra monthly)
  if (extra_monthly && lump_sum && parseFloat(extra_monthly) > 0 && parseFloat(lump_sum) > 0) {
    const lumpAmt = Math.min(parseFloat(lump_sum), currentBalance);
    const extraPmt = parseFloat(extra_monthly);
    const newBalance = currentBalance - lumpAmt;
    const result = calcPayoff(newBalance, basePayment + extraPmt, rate);
    if (result && base) {
      scenarios.combined = {
        ...result,
        monthly_payment: Math.round((basePayment + extraPmt) * 100) / 100,
        lump_amount: lumpAmt,
        extra_amount: extraPmt,
        months_saved: base.months - result.months,
        interest_saved: Math.round((base.totalInterest - result.totalInterest) * 100) / 100,
        label: 'Lump Sum + Extra Monthly',
      };
    }
  }

  // Target date analysis
  if (target_months && parseInt(target_months) > 0) {
    const targetMo = parseInt(target_months);
    if (base && targetMo < base.months) {
      const requiredPayment = findPaymentForTarget(currentBalance, rate, targetMo);
      const result = calcPayoff(currentBalance, requiredPayment, rate);
      if (result) {
        scenarios.target_date = {
          ...result,
          monthly_payment: requiredPayment,
          target_months: targetMo,
          extra_needed: Math.round((requiredPayment - basePayment) * 100) / 100,
          interest_saved: Math.round((base.totalInterest - result.totalInterest) * 100) / 100,
          label: `Pay off in ${targetMo} months`,
        };
      }
    } else {
      scenarios.target_date = {
        feasible: false,
        message: base ? 'Already achievable with current payment' : 'Cannot calculate',
      };
    }
  }

  // ARM scenarios (if applicable)
  if (loan.loan_type === 'arm' && loan.arm_rate_cap && loan.arm_rate_floor) {
    const worstCase = calcPayoff(currentBalance, basePayment, parseFloat(loan.arm_rate_cap));
    const bestCase = calcPayoff(currentBalance, basePayment, parseFloat(loan.arm_rate_floor));

    scenarios.arm_worst = worstCase ? {
      ...worstCase,
      rate: parseFloat(loan.arm_rate_cap),
      label: `ARM Worst Case (${loan.arm_rate_cap}%)`,
    } : null;

    scenarios.arm_best = bestCase ? {
      ...bestCase,
      rate: parseFloat(loan.arm_rate_floor),
      label: `ARM Best Case (${loan.arm_rate_floor}%)`,
    } : null;

    scenarios.arm_current = base ? {
      ...base,
      rate,
      label: `ARM Current Rate (${rate}%)`,
    } : null;
  }

  res.json({
    current_balance: Math.round(currentBalance * 100) / 100,
    interest_rate: rate,
    base_payment: Math.round(basePayment * 100) / 100,
    scenarios,
  });
});

export default router;

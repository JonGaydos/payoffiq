import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';
import { calcMinPayment } from '../services/debt-strategy.js';

const router = Router();
router.use(auth);

// GET /api/dashboard — Global dashboard combining all financial data
router.get('/', (req, res) => {
  // --- Loans ---
  const loans = db.prepare('SELECT * FROM loans ORDER BY loan_type, name').all();
  let totalLoanDebt = 0;
  let totalLoanOriginal = 0;
  let totalEstimatedValue = 0;
  let totalLoanInterestPaid = 0;

  const loanSummaries = loans.map(loan => {
    const latestPayment = db.prepare(
      'SELECT ending_balance, payment_date FROM payments WHERE loan_id = ? ORDER BY payment_date DESC, id DESC LIMIT 1'
    ).get(loan.id);

    const currentBalance = latestPayment
      ? parseFloat(latestPayment.ending_balance) || 0
      : parseFloat(loan.current_balance ?? loan.original_amount);

    const agg = db.prepare(`
      SELECT COUNT(*) as count,
        SUM(COALESCE(interest, 0)) as total_interest
      FROM payments WHERE loan_id = ?
    `).get(loan.id);

    totalLoanDebt += currentBalance;
    totalLoanOriginal += parseFloat(loan.original_amount) || 0;
    totalEstimatedValue += parseFloat(loan.estimated_value) || 0;
    totalLoanInterestPaid += parseFloat(agg.total_interest) || 0;

    return {
      id: loan.id,
      name: loan.name,
      loan_type: loan.loan_type,
      current_balance: Math.round(currentBalance * 100) / 100,
      original_amount: parseFloat(loan.original_amount) || 0,
      interest_rate: parseFloat(loan.interest_rate) || 0,
      monthly_payment: parseFloat(loan.monthly_payment) || 0,
      payments_made: agg.count,
      last_payment_date: latestPayment?.payment_date || null,
    };
  });

  // --- Credit Cards ---
  const cards = db.prepare('SELECT * FROM credit_cards ORDER BY name').all();
  let totalCCDebt = 0;
  let totalCCLimit = 0;

  const cardSummaries = cards.map(card => {
    const latest = db.prepare(
      'SELECT current_balance, statement_balance, snapshot_date FROM credit_card_snapshots WHERE card_id = ? ORDER BY snapshot_date DESC LIMIT 1'
    ).get(card.id);

    const balance = latest ? parseFloat(latest.current_balance) || 0 : 0;
    const limit = parseFloat(card.credit_limit) || 0;
    const utilization = limit > 0 ? Math.round((balance / limit) * 100) : 0;

    totalCCDebt += balance;
    totalCCLimit += limit;

    return {
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      current_balance: Math.round(balance * 100) / 100,
      credit_limit: limit,
      apr: parseFloat(card.apr) || 0,
      utilization,
      last_snapshot_date: latest?.snapshot_date || null,
    };
  });

  // --- Bills (unpaid) ---
  let billSummaries = [];
  let totalUnpaidBills = 0;
  let totalMonthlyBills = 0;
  try {
    const categories = db.prepare('SELECT * FROM bill_categories ORDER BY name').all();
    billSummaries = categories.map(cat => {
      const unpaid = db.prepare(`
        SELECT SUM(amount) as total, COUNT(*) as count
        FROM bills WHERE category_id = ? AND paid = 0
      `).get(cat.id);

      const lastBill = db.prepare(`
        SELECT amount, due_date FROM bills WHERE category_id = ? ORDER BY due_date DESC LIMIT 1
      `).get(cat.id);

      const monthlyAvg = db.prepare(`
        SELECT AVG(amount) as avg_amount FROM bills WHERE category_id = ?
      `).get(cat.id);

      const unpaidTotal = parseFloat(unpaid?.total) || 0;
      const avgAmount = parseFloat(monthlyAvg?.avg_amount) || 0;
      totalUnpaidBills += unpaidTotal;

      // Estimate monthly cost based on cycle
      let monthlyEstimate = avgAmount;
      if (cat.billing_cycle === 'quarterly') monthlyEstimate = avgAmount / 3;
      else if (cat.billing_cycle === 'annual') monthlyEstimate = avgAmount / 12;
      else if (cat.billing_cycle === 'semiannual') monthlyEstimate = avgAmount / 6;
      else if (cat.billing_cycle === 'bimonthly') monthlyEstimate = avgAmount / 2;
      totalMonthlyBills += monthlyEstimate;

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        billing_cycle: cat.billing_cycle,
        unpaid_total: Math.round(unpaidTotal * 100) / 100,
        unpaid_count: unpaid?.count || 0,
        last_amount: lastBill ? parseFloat(lastBill.amount) : null,
        last_due_date: lastBill?.due_date || null,
        monthly_estimate: Math.round(monthlyEstimate * 100) / 100,
      };
    }).filter(c => c.last_amount != null); // Only include categories that have bills
  } catch { /* bills tables may not exist */ }

  // --- Insurance ---
  let insuranceSummaries = [];
  let totalAnnualPremiums = 0;
  try {
    const policies = db.prepare('SELECT * FROM insurance_policies ORDER BY name').all();
    insuranceSummaries = policies.map(p => {
      const lastPayment = db.prepare(`
        SELECT amount, payment_date FROM insurance_payments
        WHERE policy_id = ? ORDER BY payment_date DESC LIMIT 1
      `).get(p.id);

      const annualCost = parseFloat(p.annual_premium) || 0;
      totalAnnualPremiums += annualCost;

      return {
        id: p.id,
        name: p.name,
        policy_type: p.policy_type,
        annual_premium: annualCost,
        monthly_cost: Math.round((annualCost / 12) * 100) / 100,
        renewal_date: p.renewal_date,
        last_payment_amount: lastPayment ? parseFloat(lastPayment.amount) : null,
        last_payment_date: lastPayment?.payment_date || null,
      };
    });
  } catch { /* insurance tables may not exist */ }

  // --- Totals ---
  const totalDebt = totalLoanDebt + totalCCDebt;
  const totalPaidDown = totalLoanOriginal - totalLoanDebt;
  const overallUtilization = totalCCLimit > 0 ? Math.round((totalCCDebt / totalCCLimit) * 100) : 0;

  // --- Monthly obligations ---
  const totalMonthlyPayments = loanSummaries.reduce((s, l) => s + l.monthly_payment, 0);
  const totalMinCardPayments = cardSummaries.reduce((s, c) => {
    return s + calcMinPayment(c.current_balance, c.apr);
  }, 0);
  const totalMonthlyInsurance = Math.round((totalAnnualPremiums / 12) * 100) / 100;
  const grandMonthlyObligations = totalMonthlyPayments + totalMinCardPayments + totalMonthlyBills + totalMonthlyInsurance;

  // --- Recent activity ---
  const recentPayments = db.prepare(`
    SELECT p.*, l.name as loan_name
    FROM payments p
    JOIN loans l ON p.loan_id = l.id
    ORDER BY p.payment_date DESC, p.id DESC
    LIMIT 5
  `).all();

  const recentSnapshots = db.prepare(`
    SELECT s.*, c.name as card_name
    FROM credit_card_snapshots s
    JOIN credit_cards c ON s.card_id = c.id
    ORDER BY s.snapshot_date DESC, s.id DESC
    LIMIT 5
  `).all();

  // Recent bills
  let recentBills = [];
  try {
    recentBills = db.prepare(`
      SELECT b.*, bc.name as category_name, bc.icon
      FROM bills b
      JOIN bill_categories bc ON b.category_id = bc.id
      ORDER BY b.due_date DESC
      LIMIT 5
    `).all();
  } catch { /* table may not exist */ }

  res.json({
    loans: loanSummaries,
    credit_cards: cardSummaries,
    bills: billSummaries,
    insurance: insuranceSummaries,
    totals: {
      total_debt: Math.round(totalDebt * 100) / 100,
      total_loan_debt: Math.round(totalLoanDebt * 100) / 100,
      total_cc_debt: Math.round(totalCCDebt * 100) / 100,
      total_cc_limit: Math.round(totalCCLimit * 100) / 100,
      cc_utilization: overallUtilization,
      total_original: Math.round(totalLoanOriginal * 100) / 100,
      total_paid_down: Math.round(totalPaidDown * 100) / 100,
      total_interest_paid: Math.round(totalLoanInterestPaid * 100) / 100,
      total_estimated_value: Math.round(totalEstimatedValue * 100) / 100,
      net_equity: totalEstimatedValue > 0
        ? Math.round((totalEstimatedValue - totalLoanDebt) * 100) / 100
        : null,
      monthly_obligations: Math.round(grandMonthlyObligations * 100) / 100,
      monthly_bills: Math.round(totalMonthlyBills * 100) / 100,
      monthly_insurance: totalMonthlyInsurance,
      total_unpaid_bills: Math.round(totalUnpaidBills * 100) / 100,
      total_annual_premiums: Math.round(totalAnnualPremiums * 100) / 100,
      loan_count: loans.length,
      card_count: cards.length,
      bill_category_count: billSummaries.length,
      insurance_count: insuranceSummaries.length,
    },
    recent_payments: recentPayments,
    recent_snapshots: recentSnapshots,
    recent_bills: recentBills,
  });
});

export default router;

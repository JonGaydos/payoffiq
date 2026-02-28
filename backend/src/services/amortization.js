/**
 * Generate a standard bank amortization schedule (original terms).
 */
export function generateBankSchedule(originalAmount, annualRate, termMonths, monthlyPayment, escrowMonthly = 0) {
  const monthlyRate = annualRate / 100 / 12;
  const schedule = [];
  let balance = originalAmount;

  for (let month = 1; month <= termMonths && balance > 0.01; month++) {
    const interest = balance * monthlyRate;
    const principalBase = monthlyPayment - escrowMonthly - interest;
    const principal = Math.min(principalBase, balance);
    balance = Math.max(0, balance - principal);

    schedule.push({
      month,
      payment: monthlyPayment,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      escrow: escrowMonthly,
      balance: Math.round(balance * 100) / 100,
    });
  }

  return schedule;
}

/**
 * Generate a dynamic schedule based on actual payment history.
 * Starts from actual payments, then projects remaining months.
 */
export function generateDynamicSchedule(originalAmount, annualRate, monthlyPayment, payments, escrowMonthly = 0) {
  const monthlyRate = annualRate / 100 / 12;
  const schedule = [];

  // Phase 1: Actual payments
  for (const pmt of payments) {
    schedule.push({
      month: schedule.length + 1,
      date: pmt.payment_date,
      payment: parseFloat(pmt.total_payment) || 0,
      principal: (parseFloat(pmt.principal) || 0) + (parseFloat(pmt.extra_principal) || 0),
      interest: parseFloat(pmt.interest) || 0,
      escrow: parseFloat(pmt.escrow) || 0,
      balance: parseFloat(pmt.ending_balance) || 0,
      actual: true,
    });
  }

  // Phase 2: Project remaining using current rate
  const lastBalance = schedule.length > 0 ? schedule[schedule.length - 1].balance : originalAmount;
  let balance = lastBalance;
  const basePayment = monthlyPayment - escrowMonthly;

  let projected = 0;
  while (balance > 0.01 && projected < 600) {
    const interest = balance * monthlyRate;
    if (basePayment <= interest) break; // Payment doesn't cover interest
    const principal = Math.min(basePayment - interest, balance);
    balance = Math.max(0, balance - principal);
    projected++;

    schedule.push({
      month: schedule.length + 1,
      payment: monthlyPayment,
      principal: Math.round(principal * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      escrow: escrowMonthly,
      balance: Math.round(balance * 100) / 100,
      actual: false,
    });
  }

  return schedule;
}

/**
 * Calculate payoff projection from a given balance.
 */
export function calcPayoff(startBalance, monthlyPayment, annualRate) {
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyPayment <= startBalance * monthlyRate) return null;

  let balance = startBalance;
  let months = 0;
  let totalInterest = 0;

  while (balance > 0.01 && months < 600) {
    const interest = balance * monthlyRate;
    const principal = Math.min(monthlyPayment - interest, balance);
    balance -= principal;
    totalInterest += interest;
    months++;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((startBalance + totalInterest) * 100) / 100,
  };
}

/**
 * Binary search for required payment to hit a target payoff date.
 */
export function findPaymentForTarget(startBalance, annualRate, targetMonths) {
  let low = startBalance * (annualRate / 100 / 12) + 0.01;
  let high = startBalance;

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const result = calcPayoff(startBalance, mid, annualRate);
    if (!result || result.months > targetMonths) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.round(high * 100) / 100;
}

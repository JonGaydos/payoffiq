/**
 * Calculate minimum payment for a credit card.
 */
export function calcMinPayment(balance, apr, minPct = 1, minFixed = 25) {
  if (balance <= 0) return 0;
  const pctPayment = balance * (minPct / 100);
  return Math.max(pctPayment, minFixed, balance < minFixed ? balance : minFixed);
}

/**
 * Calculate payoff timeline for a single card with a fixed monthly payment.
 */
export function calcCardPayoff(balance, apr, monthlyPayment) {
  if (balance <= 0) return { months: 0, totalInterest: 0, totalPaid: 0 };

  const monthlyRate = apr / 100 / 12;
  let remaining = balance;
  let months = 0;
  let totalInterest = 0;

  while (remaining > 0.01 && months < 600) {
    const interest = remaining * monthlyRate;
    const payment = Math.min(monthlyPayment, remaining + interest);
    if (payment <= interest) return null; // Can't pay off
    const principal = payment - interest;
    remaining = Math.max(0, remaining - principal);
    totalInterest += interest;
    months++;
  }

  return {
    months,
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalPaid: Math.round((balance + totalInterest) * 100) / 100,
  };
}

/**
 * Simulate debt payoff using Avalanche strategy (highest APR first).
 * Returns month-by-month schedule for all cards.
 */
export function simulateAvalanche(cards, extraMonthly = 0) {
  return simulateStrategy(cards, extraMonthly, 'avalanche');
}

/**
 * Simulate debt payoff using Snowball strategy (lowest balance first).
 * Returns month-by-month schedule for all cards.
 */
export function simulateSnowball(cards, extraMonthly = 0) {
  return simulateStrategy(cards, extraMonthly, 'snowball');
}

/**
 * Core strategy simulation.
 * @param {Array} cards - Array of { id, name, balance, apr, minPayment }
 * @param {number} extraMonthly - Extra monthly amount to throw at debt
 * @param {string} strategy - 'avalanche' or 'snowball'
 */
function simulateStrategy(cards, extraMonthly, strategy) {
  // Clone balances
  const state = cards.map(c => ({
    id: c.id,
    name: c.name,
    balance: parseFloat(c.balance) || 0,
    apr: parseFloat(c.apr) || 0,
    minPayment: parseFloat(c.minPayment) || 25,
    paidOff: false,
    paidOffMonth: null,
  }));

  const schedule = [];
  let month = 0;
  let totalInterest = 0;

  while (state.some(c => c.balance > 0.01) && month < 600) {
    month++;
    const monthEntry = { month, cards: {} };

    // Determine priority order
    const active = state.filter(c => c.balance > 0.01);
    if (strategy === 'avalanche') {
      active.sort((a, b) => b.apr - a.apr);
    } else {
      active.sort((a, b) => a.balance - b.balance);
    }

    // Pay minimums first
    let extraBudget = extraMonthly;
    for (const card of active) {
      const interest = card.balance * (card.apr / 100 / 12);
      totalInterest += interest;
      const minPmt = Math.min(card.minPayment, card.balance + interest);
      const principal = Math.max(0, minPmt - interest);
      card.balance = Math.max(0, card.balance - principal);

      monthEntry.cards[card.id] = {
        payment: Math.round(minPmt * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        principal: Math.round(principal * 100) / 100,
        balance: Math.round(card.balance * 100) / 100,
      };
    }

    // Apply extra to priority card (first in sorted order that still has balance)
    for (const card of active) {
      if (extraBudget <= 0) break;
      if (card.balance <= 0.01) continue;

      const extraPmt = Math.min(extraBudget, card.balance);
      card.balance = Math.max(0, card.balance - extraPmt);
      extraBudget -= extraPmt;

      monthEntry.cards[card.id].payment += Math.round(extraPmt * 100) / 100;
      monthEntry.cards[card.id].principal += Math.round(extraPmt * 100) / 100;
      monthEntry.cards[card.id].balance = Math.round(card.balance * 100) / 100;
    }

    // Roll over freed-up minimum payments from paid-off cards
    for (const card of state) {
      if (!card.paidOff && card.balance <= 0.01) {
        card.paidOff = true;
        card.paidOffMonth = month;
        // The freed minimum will be available as extra next month (handled by active filter)
      }
    }

    schedule.push(monthEntry);
  }

  return {
    months: month,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule: schedule.slice(0, 120), // Cap at 10 years for response size
    cardResults: state.map(c => ({
      id: c.id,
      name: c.name,
      paidOffMonth: c.paidOffMonth,
      remainingBalance: Math.round(c.balance * 100) / 100,
    })),
  };
}

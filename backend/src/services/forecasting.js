/**
 * Simple forecasting from historical bill data.
 * Uses weighted moving average with more recent months weighted higher.
 */

/**
 * Forecast next month's bill amount from historical data.
 * @param {Array} bills - Array of { amount, bill_date } sorted by date ASC
 * @param {number} lookback - Number of months to consider (default 6)
 * @returns {{ forecast, trend, avg, min, max, count }}
 */
export function forecastBill(bills, lookback = 6) {
  if (!bills || bills.length === 0) {
    return { forecast: 0, trend: 0, avg: 0, min: 0, max: 0, count: 0 };
  }

  const recent = bills.slice(-lookback);
  const amounts = recent.map(b => parseFloat(b.amount) || 0);

  const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);

  // Weighted moving average (more recent = higher weight)
  let weightedSum = 0;
  let weightTotal = 0;
  for (let i = 0; i < amounts.length; i++) {
    const weight = i + 1; // 1, 2, 3, ... (most recent gets highest)
    weightedSum += amounts[i] * weight;
    weightTotal += weight;
  }
  const forecast = weightTotal > 0 ? weightedSum / weightTotal : avg;

  // Trend: compare first half avg to second half avg
  let trend = 0;
  if (amounts.length >= 4) {
    const mid = Math.floor(amounts.length / 2);
    const firstHalf = amounts.slice(0, mid);
    const secondHalf = amounts.slice(mid);
    const firstAvg = firstHalf.reduce((s, a) => s + a, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, a) => s + a, 0) / secondHalf.length;
    trend = firstAvg > 0 ? Math.round(((secondAvg - firstAvg) / firstAvg) * 100) : 0;
  }

  return {
    forecast: Math.round(forecast * 100) / 100,
    trend,
    avg: Math.round(avg * 100) / 100,
    min: Math.round(min * 100) / 100,
    max: Math.round(max * 100) / 100,
    count: amounts.length,
  };
}

/**
 * Calculate year-over-year comparison for a category.
 * @param {Array} bills - All bills for a category, sorted by date ASC
 * @returns {{ currentYear, previousYear, yoyChange }}
 */
export function calcYoY(bills) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastYear = thisYear - 1;

  const thisYearBills = bills.filter(b => {
    const d = new Date(b.bill_date);
    return d.getFullYear() === thisYear;
  });
  const lastYearBills = bills.filter(b => {
    const d = new Date(b.bill_date);
    return d.getFullYear() === lastYear;
  });

  const currentTotal = thisYearBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
  const previousTotal = lastYearBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

  const yoyChange = previousTotal > 0
    ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
    : 0;

  return {
    currentYear: { year: thisYear, total: Math.round(currentTotal * 100) / 100, count: thisYearBills.length },
    previousYear: { year: lastYear, total: Math.round(previousTotal * 100) / 100, count: lastYearBills.length },
    yoyChange,
  };
}

/**
 * Get monthly aggregates for charting.
 * @param {Array} bills - All bills sorted by date ASC
 * @param {number} months - Number of months to aggregate (default 12)
 * @returns {Array} - [{ month: 'YYYY-MM', total, count, avgUsage }]
 */
export function monthlyAggregates(bills, months = 12) {
  const now = new Date();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const monthBills = bills.filter(b => {
      const bd = new Date(b.bill_date);
      return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth();
    });

    const total = monthBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
    const usage = monthBills
      .filter(b => b.usage_amount != null)
      .reduce((s, b) => s + (parseFloat(b.usage_amount) || 0), 0);
    const usageCount = monthBills.filter(b => b.usage_amount != null).length;

    result.push({
      month: monthKey,
      total: Math.round(total * 100) / 100,
      count: monthBills.length,
      usage: usageCount > 0 ? Math.round(usage * 100) / 100 : null,
    });
  }

  return result;
}

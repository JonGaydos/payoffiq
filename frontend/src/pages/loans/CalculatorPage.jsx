import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { fmtMonths } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

export default function CalculatorPage() {
  const { loanId } = useParams();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const [inputs, setInputs] = useState({
    extra_monthly: '',
    lump_sum: '',
    target_months: '',
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  // Run calculation on mount with empty inputs to get base scenario
  useEffect(() => {
    runCalc({});
  }, [loanId]);

  const runCalc = async (overrides) => {
    setLoading(true);
    const body = { ...inputs, ...overrides };
    const res = await authFetch(`${API_BASE}/calculator/loan/${loanId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (res.ok) setResults(await res.json());
    setLoading(false);
  };

  const handleCalculate = () => runCalc({});

  const handleChange = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  // Build comparison chart data
  const chartData = [];
  if (results?.scenarios) {
    const { base, extra_monthly, lump_sum, combined, target_date } = results.scenarios;
    if (base) chartData.push({ name: 'Current', months: base.months, interest: base.totalInterest });
    if (extra_monthly) chartData.push({ name: extra_monthly.label, months: extra_monthly.months, interest: extra_monthly.totalInterest });
    if (lump_sum) chartData.push({ name: 'Lump Sum', months: lump_sum.months, interest: lump_sum.totalInterest });
    if (combined) chartData.push({ name: 'Combined', months: combined.months, interest: combined.totalInterest });
    if (target_date && target_date.months) chartData.push({ name: 'Target', months: target_date.months, interest: target_date.totalInterest });
  }

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-lg font-bold">Payoff Calculator</h2>

      {/* Input Form */}
      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Extra Monthly Payment">
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder="e.g. 200"
              value={inputs.extra_monthly}
              onChange={e => handleChange('extra_monthly', e.target.value)}
            />
          </Field>
          <Field label="One-Time Lump Sum">
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder="e.g. 5000"
              value={inputs.lump_sum}
              onChange={e => handleChange('lump_sum', e.target.value)}
            />
          </Field>
          <Field label="Target Months to Payoff">
            <input
              type="number"
              className="input-field"
              placeholder="e.g. 120"
              value={inputs.target_months}
              onChange={e => handleChange('target_months', e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={handleCalculate} disabled={loading}>
            {loading ? 'Calculating...' : 'Calculate Scenarios'}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {results && (
        <>
          {/* Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="Current Balance" value={fmt(results.current_balance)} />
            <StatCard label="Interest Rate" value={`${results.interest_rate}%`} />
            <StatCard label="Base Payment" value={fmt(results.base_payment)} />
          </div>

          {/* Scenario Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.scenarios.base && (
              <ScenarioCard
                label="Current Payment"
                scenario={results.scenarios.base}
                fmt={fmt}
                color="var(--color-warm-gray)"
              />
            )}
            {results.scenarios.extra_monthly && (
              <ScenarioCard
                label={results.scenarios.extra_monthly.label}
                scenario={results.scenarios.extra_monthly}
                fmt={fmt}
                color="var(--color-sage)"
                savings
              />
            )}
            {results.scenarios.lump_sum && (
              <ScenarioCard
                label={results.scenarios.lump_sum.label}
                scenario={results.scenarios.lump_sum}
                fmt={fmt}
                color="var(--color-gold)"
                savings
              />
            )}
            {results.scenarios.combined && (
              <ScenarioCard
                label="Combined Strategy"
                scenario={results.scenarios.combined}
                fmt={fmt}
                color="var(--color-terracotta)"
                savings
              />
            )}
            {results.scenarios.target_date && (
              <Card accent="var(--color-sage)">
                <h4 className="font-serif font-bold text-sm mb-2">Target Date</h4>
                {results.scenarios.target_date.feasible === false ? (
                  <p className="text-warm-gray text-sm">{results.scenarios.target_date.message}</p>
                ) : (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-warm-gray">Required Payment</span>
                      <span className="font-semibold">{fmt(results.scenarios.target_date.monthly_payment)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-warm-gray">Extra Needed</span>
                      <span className="font-semibold text-terracotta">{fmt(results.scenarios.target_date.extra_needed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-warm-gray">Interest Saved</span>
                      <Badge color="green">{fmt(results.scenarios.target_date.interest_saved)}</Badge>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* ARM Scenarios */}
          {(results.scenarios.arm_worst || results.scenarios.arm_best) && (
            <Card>
              <h3 className="font-serif font-bold mb-4">ARM Rate Scenarios</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {results.scenarios.arm_best && (
                  <div className="text-center">
                    <div className="text-xs text-warm-gray uppercase font-semibold mb-1">Best Case ({results.scenarios.arm_best.rate}%)</div>
                    <div className="font-serif font-bold text-lg text-sage">{fmtMonths(results.scenarios.arm_best.months)}</div>
                    <div className="text-xs text-warm-gray">{fmt(results.scenarios.arm_best.totalInterest)} interest</div>
                  </div>
                )}
                {results.scenarios.arm_current && (
                  <div className="text-center">
                    <div className="text-xs text-warm-gray uppercase font-semibold mb-1">Current ({results.scenarios.arm_current.rate}%)</div>
                    <div className="font-serif font-bold text-lg">{fmtMonths(results.scenarios.arm_current.months)}</div>
                    <div className="text-xs text-warm-gray">{fmt(results.scenarios.arm_current.totalInterest)} interest</div>
                  </div>
                )}
                {results.scenarios.arm_worst && (
                  <div className="text-center">
                    <div className="text-xs text-warm-gray uppercase font-semibold mb-1">Worst Case ({results.scenarios.arm_worst.rate}%)</div>
                    <div className="font-serif font-bold text-lg text-terracotta">{fmtMonths(results.scenarios.arm_worst.months)}</div>
                    <div className="text-xs text-warm-gray">{fmt(results.scenarios.arm_worst.totalInterest)} interest</div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Comparison Chart */}
          {chartData.length > 1 && (
            <Card>
              <h3 className="font-serif font-bold mb-4">Scenario Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
                  <YAxis yAxisId="months" tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" label={{ value: 'Months', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                  <YAxis yAxisId="interest" orientation="right" tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(val, name) => name === 'interest' ? fmt(val) : `${val} months`}
                  />
                  <Legend />
                  <Bar yAxisId="months" dataKey="months" fill="var(--color-gold)" name="Months" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="interest" dataKey="interest" fill="var(--color-terracotta)" name="Total Interest" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function ScenarioCard({ label, scenario, fmt, color, savings }) {
  return (
    <Card accent={color}>
      <h4 className="font-serif font-bold text-sm mb-2">{label}</h4>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-warm-gray">Payoff In</span>
          <span className="font-semibold">{fmtMonths(scenario.months)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-gray">Monthly Payment</span>
          <span className="font-semibold">{fmt(scenario.monthly_payment)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-gray">Total Interest</span>
          <span>{fmt(scenario.totalInterest)}</span>
        </div>
        {savings && scenario.months_saved > 0 && (
          <div className="flex justify-between pt-1 border-t border-card-border">
            <span className="text-warm-gray">Months Saved</span>
            <Badge color="green">{scenario.months_saved}</Badge>
          </div>
        )}
        {savings && scenario.interest_saved > 0 && (
          <div className="flex justify-between">
            <span className="text-warm-gray">Interest Saved</span>
            <Badge color="green">{fmt(scenario.interest_saved)}</Badge>
          </div>
        )}
      </div>
    </Card>
  );
}

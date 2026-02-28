import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { API_BASE } from '../utils/api';
import { fmtDate } from '../utils/formatters';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

const COLORS = [
  'var(--color-terracotta)', 'var(--color-gold)', 'var(--color-sage)',
  'var(--color-warm-gray)', '#8884d8', '#82ca9d', '#ffc658',
];

export default function DashboardPage() {
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch(`${API_BASE}/dashboard`).then(r => r.ok ? r.json() : null),
      authFetch(`${API_BASE}/strategy/overview`).then(r => r.ok ? r.json() : null),
    ]).then(([dashData, stratData]) => {
      setData(dashData);
      setStrategy(stratData);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;

  // Empty state — no data yet
  if (!data || (data.totals.loan_count === 0 && data.totals.card_count === 0 && (data.totals.bill_category_count || 0) === 0 && (data.totals.insurance_count || 0) === 0)) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-bold text-ink mb-6">Dashboard</h1>
        <Card>
          <div className="text-center py-12">
            <div className="text-5xl mb-4">{'\u{1F4B0}'}</div>
            <h2 className="font-serif text-xl font-bold text-ink mb-2">
              Welcome to PayoffIQ
            </h2>
            <p className="text-warm-gray text-sm max-w-md mx-auto">
              Your personal finance command center. Start by adding your loans,
              credit cards, and household bills to see your complete financial picture.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 justify-center">
              <Button onClick={() => navigate('/loans')}>Add a Loan</Button>
              <Button variant="outline" onClick={() => navigate('/credit-cards')}>Add a Credit Card</Button>
              <Button variant="ghost" onClick={() => navigate('/settings')}>Configure Settings</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const { totals } = data;

  // Debt breakdown for pie chart — includes loans, credit cards, unpaid bills, insurance
  const debtBreakdown = [
    ...data.loans.filter(l => l.current_balance > 0).map(l => ({
      name: l.name, value: l.current_balance, type: 'loan',
    })),
    ...data.credit_cards.filter(c => c.current_balance > 0).map(c => ({
      name: c.name, value: c.current_balance, type: 'card',
    })),
    ...(data.bills || []).filter(b => b.unpaid_total > 0).map(b => ({
      name: `${b.icon || '\u{1F4A1}'} ${b.name}`, value: b.unpaid_total, type: 'bill',
    })),
  ];

  // Monthly cost breakdown for second pie chart
  const monthlyBreakdown = [
    ...data.loans.filter(l => l.monthly_payment > 0).map(l => ({
      name: l.name, value: l.monthly_payment, type: 'loan',
    })),
    ...(data.bills || []).filter(b => b.monthly_estimate > 0).map(b => ({
      name: `${b.icon || '\u{1F4A1}'} ${b.name}`, value: b.monthly_estimate, type: 'bill',
    })),
    ...(data.insurance || []).filter(p => p.monthly_cost > 0).map(p => ({
      name: `\u{1F6E1}\uFE0F ${p.name}`, value: p.monthly_cost, type: 'insurance',
    })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-bold">Dashboard</h1>

      {/* Top-line Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Debt"
          value={fmt(totals.total_debt)}
          color="var(--color-terracotta)"
        />
        {totals.net_equity != null && (
          <StatCard
            label="Net Home Equity"
            value={fmt(totals.net_equity)}
            color={totals.net_equity >= 0 ? 'var(--color-sage)' : 'var(--color-terracotta)'}
            subtitle={totals.total_estimated_value > 0 ? `Value: ${fmt(totals.total_estimated_value)}` : ''}
          />
        )}
        <StatCard
          label="Monthly Obligations"
          value={fmt(totals.monthly_obligations)}
          color="var(--color-gold)"
          subtitle={`Loans + Cards + Bills + Insurance`}
        />
        <StatCard
          label="Interest Paid"
          value={fmt(totals.total_interest_paid)}
          subtitle="Across all loans"
        />
        {totals.total_unpaid_bills > 0 && (
          <StatCard
            label="Unpaid Bills"
            value={fmt(totals.total_unpaid_bills)}
            color="var(--color-terracotta)"
          />
        )}
        {totals.total_annual_premiums > 0 && (
          <StatCard
            label="Annual Premiums"
            value={fmt(totals.total_annual_premiums)}
            color="var(--color-warm-gray)"
            subtitle={`${fmt(totals.monthly_insurance)}/mo`}
          />
        )}
      </div>

      {/* Debt Overview Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Debt Breakdown Pie */}
        {debtBreakdown.length > 0 && (
          <Card>
            <h3 className="font-serif font-bold mb-4">Debt Breakdown</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={debtBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {debtBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => fmt(val)}
                  contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Strategy Preview */}
        {/* Monthly Cost Breakdown */}
        {monthlyBreakdown.length > 0 && !debtBreakdown.length && (
          <Card>
            <h3 className="font-serif font-bold mb-4">Monthly Obligations</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={monthlyBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={2}
                >
                  {monthlyBreakdown.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val) => `${fmt(val)}/mo`}
                  contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}

        {strategy && !strategy.debt_free && (
          <Card accent="var(--color-gold)">
            <h3 className="font-serif font-bold mb-4">Payoff Strategy Preview</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-terracotta/10">
                  <p className="text-xs text-warm-gray mb-1">Avalanche</p>
                  <p className="font-serif text-xl font-bold" style={{ color: 'var(--color-terracotta)' }}>
                    {strategy.avalanche.months} mo
                  </p>
                  <p className="text-xs text-warm-gray mt-1">
                    {fmt(strategy.avalanche.totalInterest)} interest
                  </p>
                </div>
                <div className="text-center p-3 rounded-lg bg-sage/10">
                  <p className="text-xs text-warm-gray mb-1">Snowball</p>
                  <p className="font-serif text-xl font-bold" style={{ color: 'var(--color-sage)' }}>
                    {strategy.snowball.months} mo
                  </p>
                  <p className="text-xs text-warm-gray mt-1">
                    {fmt(strategy.snowball.totalInterest)} interest
                  </p>
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-warm-gray">
                  Best: <span className="font-semibold capitalize">{strategy.best_strategy}</span>
                  {' \u2014 '}Debt-free by {fmtDate(strategy[strategy.best_strategy].debtFreeDate)}
                </p>
                <Button
                  variant="outline"
                  className="mt-3 text-xs"
                  onClick={() => navigate('/strategy')}
                >
                  Explore Strategies
                </Button>
              </div>
            </div>
          </Card>
        )}

        {strategy && strategy.debt_free && (
          <Card accent="var(--color-sage)">
            <div className="text-center py-8">
              <div className="text-4xl mb-3">{'\u{1F389}'}</div>
              <h3 className="font-serif text-lg font-bold">Debt Free!</h3>
              <p className="text-sm text-warm-gray mt-1">No outstanding debt balances</p>
            </div>
          </Card>
        )}
      </div>

      {/* Loans Summary */}
      {data.loans.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold">Loans ({data.loans.length})</h3>
            <Button variant="ghost" className="text-xs" onClick={() => navigate('/loans')}>
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {data.loans.map(loan => (
              <div
                key={loan.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/loans/${loan.id}`)}
              >
                <span className="text-sm">
                  {loan.loan_type === 'mortgage' ? '\u{1F3E0}' : loan.loan_type === 'auto' ? '\u{1F697}' : loan.loan_type === 'arm' ? '\u{1F4C8}' : loan.loan_type === 'heloc' ? '\u{1F3E6}' : '\u{1F464}'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{loan.name}</p>
                  <p className="text-xs text-warm-gray">{loan.interest_rate}% APR</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{fmt(loan.current_balance)}</p>
                  <p className="text-xs text-warm-gray">{fmt(loan.monthly_payment)}/mo</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Credit Cards Summary */}
      {data.credit_cards.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold">Credit Cards ({data.credit_cards.length})</h3>
            <Button variant="ghost" className="text-xs" onClick={() => navigate('/credit-cards')}>
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {data.credit_cards.map(card => (
              <div
                key={card.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/credit-cards/${card.id}`)}
              >
                <span className="text-sm">{'\u{1F4B3}'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{card.name}</p>
                  <p className="text-xs text-warm-gray">{card.apr}% APR</p>
                </div>
                <Badge color={card.utilization > 50 ? 'red' : card.utilization > 30 ? 'orange' : 'green'}>
                  {card.utilization}%
                </Badge>
                <div className="text-right">
                  <p className="text-sm font-semibold">{fmt(card.current_balance)}</p>
                  <p className="text-xs text-warm-gray">of {fmt(card.credit_limit)}</p>
                </div>
              </div>
            ))}
          </div>
          {totals.card_count > 0 && totals.cc_utilization > 0 && (
            <div className="mt-3 pt-3 border-t border-card-border">
              <div className="flex justify-between text-xs text-warm-gray mb-1">
                <span>Overall Utilization</span>
                <span>{totals.cc_utilization}%</span>
              </div>
              <div className="h-2 bg-card-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(totals.cc_utilization, 100)}%`,
                    background: totals.cc_utilization > 50 ? 'var(--color-terracotta)' : totals.cc_utilization > 30 ? 'var(--color-gold)' : 'var(--color-sage)',
                  }}
                />
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Bills Summary */}
      {(data.bills || []).length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold">Utility Bills ({data.bills.length})</h3>
            <Button variant="ghost" className="text-xs" onClick={() => navigate('/bills')}>
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {data.bills.map(bill => (
              <div
                key={bill.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream/30 cursor-pointer transition-colors"
                onClick={() => navigate(`/bills/${bill.id}`)}
              >
                <span className="text-sm">{bill.icon || '\u{1F4A1}'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{bill.name}</p>
                  <p className="text-xs text-warm-gray capitalize">{bill.billing_cycle}</p>
                </div>
                {bill.unpaid_count > 0 && (
                  <Badge color="red">{bill.unpaid_count} unpaid</Badge>
                )}
                <div className="text-right">
                  <p className="text-sm font-semibold">{bill.last_amount != null ? fmt(bill.last_amount) : '-'}</p>
                  <p className="text-xs text-warm-gray">~{fmt(bill.monthly_estimate)}/mo</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Insurance Summary */}
      {(data.insurance || []).length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif font-bold">Insurance ({data.insurance.length})</h3>
            <Button variant="ghost" className="text-xs" onClick={() => navigate('/insurance')}>
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {data.insurance.map(policy => (
              <div
                key={policy.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-cream/30 cursor-pointer transition-colors"
                onClick={() => navigate('/insurance')}
              >
                <span className="text-sm">{'\u{1F6E1}\uFE0F'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{policy.name}</p>
                  <p className="text-xs text-warm-gray capitalize">{policy.policy_type}</p>
                </div>
                {policy.renewal_date && (
                  <span className="text-xs text-warm-gray">Renews {fmtDate(policy.renewal_date)}</span>
                )}
                <div className="text-right">
                  <p className="text-sm font-semibold">{fmt(policy.annual_premium)}/yr</p>
                  <p className="text-xs text-warm-gray">{fmt(policy.monthly_cost)}/mo</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent Activity */}
      {(data.recent_payments.length > 0 || data.recent_snapshots.length > 0 || (data.recent_bills || []).length > 0) && (
        <Card>
          <h3 className="font-serif font-bold mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {data.recent_payments.map(p => (
              <div key={`p-${p.id}`} className="flex items-center gap-3 text-sm">
                <span className="text-xs">{'\u{1F4B5}'}</span>
                <span className="flex-1 truncate">
                  <span className="font-semibold">{p.loan_name}</span> payment
                </span>
                <span className="text-warm-gray text-xs">{fmtDate(p.payment_date)}</span>
                <span className="font-semibold">{fmt(p.total_payment)}</span>
              </div>
            ))}
            {data.recent_snapshots.map(s => (
              <div key={`s-${s.id}`} className="flex items-center gap-3 text-sm">
                <span className="text-xs">{'\u{1F4B3}'}</span>
                <span className="flex-1 truncate">
                  <span className="font-semibold">{s.card_name}</span> snapshot
                </span>
                <span className="text-warm-gray text-xs">{fmtDate(s.snapshot_date)}</span>
                <span className="font-semibold">{fmt(s.current_balance)}</span>
              </div>
            ))}
            {(data.recent_bills || []).map(b => (
              <div key={`b-${b.id}`} className="flex items-center gap-3 text-sm">
                <span className="text-xs">{b.icon || '\u{1F4A1}'}</span>
                <span className="flex-1 truncate">
                  <span className="font-semibold">{b.category_name}</span> bill
                </span>
                <span className="text-warm-gray text-xs">{fmtDate(b.due_date)}</span>
                <span className="font-semibold">{fmt(b.amount)}</span>
                {b.paid ? <Badge color="green">Paid</Badge> : <Badge color="red">Due</Badge>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

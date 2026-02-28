import { useState, useEffect } from 'react';
import { useParams, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { LOAN_TYPES } from '../../utils/constants';
import { fmtMonths } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const CHART_COLORS = ['var(--color-gold)', 'var(--color-sage)', 'var(--color-terracotta)'];

export default function LoanDashboardPage() {
  const { loanId } = useParams();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await authFetch(`${API_BASE}/analytics/loan/${loanId}`);
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
  }, [loanId]);

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;
  if (!data) return <div className="text-warm-gray text-center py-12">Loan not found.</div>;

  const { loan, summary, payoff_projection, bank_schedule, dynamic_schedule } = data;
  const loanType = LOAN_TYPES.find(t => t.value === loan.loan_type) || LOAN_TYPES[0];

  // Balance over time data from dynamic schedule
  const balanceData = dynamic_schedule
    .filter((_, i) => i % Math.max(1, Math.floor(dynamic_schedule.length / 60)) === 0 || !_.actual)
    .map(row => ({
      month: row.month,
      balance: row.balance,
      actual: row.actual,
    }));

  // Principal vs Interest pie data
  const pieData = [
    { name: 'Principal', value: summary.total_principal },
    { name: 'Interest', value: summary.total_interest },
    ...(summary.total_escrow > 0 ? [{ name: 'Escrow', value: summary.total_escrow }] : []),
  ].filter(d => d.value > 0);

  // Sub-navigation tabs
  const tabs = [
    { to: `/loans/${loanId}`, label: 'Overview', end: true },
    { to: `/loans/${loanId}/payments`, label: 'Payments' },
    { to: `/loans/${loanId}/calculator`, label: 'Calculator' },
  ];
  if (loanType.hasEscrow) tabs.push({ to: `/loans/${loanId}/escrow`, label: 'Escrow' });
  if (loan.loan_type === 'arm') tabs.push({ to: `/loans/${loanId}/arm-rates`, label: 'ARM Rates' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="font-serif text-2xl font-bold">{loan.name}</h1>
        <Badge color={loan.loan_type === 'arm' ? 'orange' : 'blue'}>
          {loanType.icon} {loanType.label}
        </Badge>
        {summary.months_ahead > 0 && (
          <Badge color="green">{summary.months_ahead} months ahead</Badge>
        )}
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-card-border pb-0">
        {tabs.map(tab => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-gold text-gold'
                  : 'border-transparent text-warm-gray hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Outlet for sub-pages; show overview if at base path */}
      <Outlet context={{ loan, summary, data }} />
    </div>
  );
}

// Default overview component shown at /loans/:loanId
export function LoanOverview() {
  const { loanId } = useParams();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const res = await authFetch(`${API_BASE}/analytics/loan/${loanId}`);
      if (res.ok) setData(await res.json());
    })();
  }, [loanId]);

  if (!data) return null;

  const { loan, summary, payoff_projection, bank_schedule, dynamic_schedule } = data;

  const balanceData = dynamic_schedule
    .filter((_, i) => i % Math.max(1, Math.floor(dynamic_schedule.length / 60)) === 0)
    .map(row => ({
      month: row.month,
      balance: row.balance,
    }));

  const pieData = [
    { name: 'Principal', value: summary.total_principal },
    { name: 'Interest', value: summary.total_interest },
    ...(summary.total_escrow > 0 ? [{ name: 'Escrow', value: summary.total_escrow }] : []),
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Current Balance" value={fmt(summary.current_balance)} color="var(--color-terracotta)" />
        <StatCard
          label="Payoff In"
          value={payoff_projection ? fmtMonths(payoff_projection.months) : 'N/A'}
          subtitle={payoff_projection ? `${fmt(payoff_projection.totalInterest)} remaining interest` : ''}
        />
        <StatCard label="Total Paid" value={fmt(summary.total_paid)} color="var(--color-sage)" />
        <StatCard
          label="Payments Made"
          value={summary.payments_made}
          subtitle={summary.months_ahead > 0 ? `${summary.months_ahead} months ahead` : ''}
        />
      </div>

      {/* Net Equity */}
      {summary.net_equity != null && (
        <StatCard
          label="Net Home Equity"
          value={fmt(summary.net_equity)}
          subtitle={`Estimated value: ${fmt(summary.estimated_value)}`}
          color={summary.net_equity >= 0 ? 'var(--color-sage)' : 'var(--color-terracotta)'}
        />
      )}

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Balance Over Time */}
        <Card>
          <h3 className="font-serif font-bold mb-4">Balance Over Time</h3>
          {balanceData.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val) => fmt(val)}
                  contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--color-gold)" fill="var(--color-gold)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-warm-gray text-sm text-center py-8">Add payments to see balance chart</p>
          )}
        </Card>

        {/* Payment Breakdown */}
        <Card>
          <h3 className="font-serif font-bold mb-4">Payment Breakdown</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center justify-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => fmt(val)} contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="text-warm-gray">{d.name}:</span>
                    <span className="font-semibold">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-warm-gray text-sm text-center py-8">No payment data yet</p>
          )}
        </Card>
      </div>

      {/* Amortization Schedule Preview */}
      <Card>
        <h3 className="font-serif font-bold mb-4">Amortization Schedule</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">#</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Payment</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Principal</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Interest</th>
                <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Balance</th>
                <th className="text-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Type</th>
              </tr>
            </thead>
            <tbody>
              {dynamic_schedule.slice(0, 24).map((row, i) => (
                <tr key={i} className="border-b border-card-border">
                  <td className="px-3 py-2">{row.month}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.payment)}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.principal)}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.interest)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{fmt(row.balance)}</td>
                  <td className="px-3 py-2 text-center">
                    <Badge color={row.actual ? 'green' : 'gray'}>
                      {row.actual ? 'Actual' : 'Projected'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dynamic_schedule.length > 24 && (
            <p className="text-xs text-warm-gray text-center mt-2 py-2">
              Showing first 24 of {dynamic_schedule.length} months
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

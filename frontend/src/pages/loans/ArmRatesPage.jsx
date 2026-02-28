import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { fmtDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Field from '../../components/ui/Field';
import Badge from '../../components/ui/Badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function ArmRatesPage() {
  const { loanId } = useParams();
  const { authFetch } = useAuth();
  const [rates, setRates] = useState([]);
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    effective_date: new Date().toISOString().split('T')[0],
    rate: '',
    notes: '',
  });

  const loadData = async () => {
    const [ratesRes, loanRes] = await Promise.all([
      authFetch(`${API_BASE}/arm-rates/loan/${loanId}`),
      authFetch(`${API_BASE}/loans/${loanId}`),
    ]);
    if (ratesRes.ok) setRates(await ratesRes.json());
    if (loanRes.ok) setLoan(await loanRes.json());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [loanId]);

  const handleSave = async () => {
    const res = await authFetch(`${API_BASE}/arm-rates/loan/${loanId}`, {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ effective_date: new Date().toISOString().split('T')[0], rate: '', notes: '' });
      loadData();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rate entry?')) return;
    await authFetch(`${API_BASE}/arm-rates/${id}`, { method: 'DELETE' });
    loadData();
  };

  if (loading) return <div className="text-warm-gray text-center py-8">Loading...</div>;

  // Chart data
  const chartData = rates.map(r => ({
    date: r.effective_date,
    rate: parseFloat(r.rate),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold">ARM Rate History</h2>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Rate Change'}
        </Button>
      </div>

      {/* Current Rate Info */}
      {loan && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card accent="var(--color-gold)">
            <div className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-1">Current Rate</div>
            <div className="text-2xl font-serif font-bold">{loan.interest_rate}%</div>
          </Card>
          {loan.arm_fixed_months && (
            <Card>
              <div className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-1">Fixed Period</div>
              <div className="text-2xl font-serif font-bold">{loan.arm_fixed_months} mo</div>
            </Card>
          )}
          {loan.arm_initial_cap && (
            <Card>
              <div className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-1">Initial Cap</div>
              <div className="text-2xl font-serif font-bold">{loan.arm_initial_cap}%</div>
              <div className="text-[10px] text-warm-gray">Max at first adjustment</div>
            </Card>
          )}
          {loan.arm_periodic_cap && (
            <Card>
              <div className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-1">Periodic Cap</div>
              <div className="text-2xl font-serif font-bold">{loan.arm_periodic_cap}%</div>
              <div className="text-[10px] text-warm-gray">Max per adjustment</div>
            </Card>
          )}
          {loan.arm_rate_cap && (
            <Card accent="var(--color-terracotta)">
              <div className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-1">Lifetime Cap</div>
              <div className="text-2xl font-serif font-bold">{loan.arm_rate_cap}%</div>
              <div className="text-[10px] text-warm-gray">Max rate over loan life</div>
            </Card>
          )}
          {loan.arm_rate_floor && (
            <Card accent="var(--color-sage)">
              <div className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-1">Rate Floor</div>
              <div className="text-2xl font-serif font-bold">{loan.arm_rate_floor}%</div>
              <div className="text-[10px] text-warm-gray">Minimum rate allowed</div>
            </Card>
          )}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <Card>
          <h3 className="font-serif font-bold mb-4">Record Rate Change</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Effective Date">
              <input
                type="date"
                className="input-field"
                value={form.effective_date}
                onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
              />
            </Field>
            <Field label="New Rate (%)">
              <input
                type="number"
                step="0.001"
                className="input-field"
                placeholder="e.g. 5.25"
                value={form.rate}
                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              />
            </Field>
            <Field label="Notes">
              <input
                type="text"
                className="input-field"
                placeholder="Optional"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Button onClick={handleSave}>Save Rate Change</Button>
          </div>
        </Card>
      )}

      {/* Rate History Chart */}
      {chartData.length > 1 && (
        <Card>
          <h3 className="font-serif font-bold mb-4">Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="var(--color-warm-gray)"
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tickFormatter={v => `${v}%`}
              />
              <Tooltip
                formatter={val => `${val}%`}
                contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
              />
              {loan?.arm_rate_cap && (
                <ReferenceLine y={parseFloat(loan.arm_rate_cap)} stroke="var(--color-terracotta)" strokeDasharray="5 5" label={{ value: 'Cap', position: 'right', fill: 'var(--color-terracotta)', fontSize: 10 }} />
              )}
              {loan?.arm_rate_floor && (
                <ReferenceLine y={parseFloat(loan.arm_rate_floor)} stroke="var(--color-sage)" strokeDasharray="5 5" label={{ value: 'Floor', position: 'right', fill: 'var(--color-sage)', fontSize: 10 }} />
              )}
              <Line type="stepAfter" dataKey="rate" stroke="var(--color-gold)" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Rate History Table */}
      <Card>
        <h3 className="font-serif font-bold mb-3">Rate History</h3>
        {rates.length === 0 ? (
          <p className="text-warm-gray text-sm text-center py-4">No rate changes recorded. Add entries to track ARM rate adjustments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Effective Date</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Rate</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Change</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Notes</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r, i) => {
                  const prevRate = i > 0 ? parseFloat(rates[i - 1].rate) : null;
                  const currentRate = parseFloat(r.rate);
                  const change = prevRate != null ? currentRate - prevRate : null;
                  return (
                    <tr key={r.id} className="border-b border-card-border">
                      <td className="px-3 py-2">{fmtDate(r.effective_date)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{r.rate}%</td>
                      <td className="px-3 py-2">
                        {change != null && (
                          <Badge color={change > 0 ? 'red' : change < 0 ? 'green' : 'gray'}>
                            {change > 0 ? '+' : ''}{change.toFixed(3)}%
                          </Badge>
                        )}
                        {change == null && <Badge color="gray">Initial</Badge>}
                      </td>
                      <td className="px-3 py-2 text-warm-gray">{r.notes || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-warm-gray hover:text-danger">Del</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

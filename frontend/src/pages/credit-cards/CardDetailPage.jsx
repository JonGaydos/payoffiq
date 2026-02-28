import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { fmtDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import Field from '../../components/ui/Field';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

export default function CardDetailPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSnapshotForm, setShowSnapshotForm] = useState(false);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      snapshot_date: new Date().toISOString().split('T')[0],
      statement_balance: '',
      current_balance: '',
      minimum_payment: '',
      payment_made: '',
      notes: '',
    };
  }

  const loadData = async () => {
    const res = await authFetch(`${API_BASE}/credit-cards/${cardId}/analytics`);
    if (res.ok) {
      setData(await res.json());
    } else {
      navigate('/credit-cards');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [cardId]);

  const openNewSnapshot = () => {
    setEditSnapshot(null);
    setForm(getEmptyForm());
    setShowSnapshotForm(true);
  };

  const openEditSnapshot = (snap) => {
    setEditSnapshot(snap);
    setForm({
      snapshot_date: snap.snapshot_date,
      statement_balance: snap.statement_balance || '',
      current_balance: snap.current_balance || '',
      minimum_payment: snap.minimum_payment || '',
      payment_made: snap.payment_made || '',
      notes: snap.notes || '',
    });
    setShowSnapshotForm(true);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveSnapshot = async () => {
    const url = editSnapshot
      ? `${API_BASE}/credit-cards/snapshots/${editSnapshot.id}`
      : `${API_BASE}/credit-cards/${cardId}/snapshots`;
    const res = await authFetch(url, {
      method: editSnapshot ? 'PUT' : 'POST',
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowSnapshotForm(false);
      loadData();
    }
  };

  const deleteSnapshot = async (id) => {
    if (!confirm('Delete this snapshot?')) return;
    await authFetch(`${API_BASE}/credit-cards/snapshots/${id}`, { method: 'DELETE' });
    loadData();
  };

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;
  if (!data) return null;

  const { card, snapshots, analytics } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" onClick={() => navigate('/credit-cards')} className="text-xs">
          &larr; Back
        </Button>
        <h1 className="font-serif text-2xl font-bold">{card.name}</h1>
        {card.issuer && <span className="text-warm-gray text-sm">{card.issuer}{card.last_four ? ` ****${card.last_four}` : ''}</span>}
        {analytics && (
          <Badge color={analytics.utilization > 50 ? 'red' : analytics.utilization > 30 ? 'orange' : 'green'}>
            {analytics.utilization}% utilization
          </Badge>
        )}
      </div>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Current Balance"
            value={fmt(analytics.current_balance)}
            color="var(--color-terracotta)"
          />
          <StatCard
            label="Credit Limit"
            value={fmt(analytics.credit_limit)}
          />
          <StatCard
            label="APR"
            value={`${card.apr}%`}
            color="var(--color-gold)"
          />
          <StatCard
            label="Est. Payoff"
            value={analytics.payoff_months ? `${analytics.payoff_months} mo` : 'N/A'}
            subtitle={analytics.avg_payment > 0 ? `Avg payment: ${fmt(analytics.avg_payment)}` : ''}
          />
        </div>
      )}

      {/* Utilization Bar */}
      {analytics && analytics.credit_limit > 0 && (
        <Card>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-warm-gray">Credit Utilization</span>
            <span className="font-semibold">{fmt(analytics.current_balance)} / {fmt(analytics.credit_limit)}</span>
          </div>
          <div className="h-4 bg-card-border rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(analytics.utilization, 100)}%`,
                background: analytics.utilization > 50 ? 'var(--color-terracotta)' : analytics.utilization > 30 ? 'var(--color-gold)' : 'var(--color-sage)',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-warm-gray mt-1">
            <span>0%</span>
            <span className="text-sage">30%</span>
            <span className="text-gold">50%</span>
            <span>100%</span>
          </div>
        </Card>
      )}

      {/* Charts */}
      {analytics && analytics.velocity_data && analytics.velocity_data.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Balance Velocity */}
          <Card>
            <h3 className="font-serif font-bold mb-4">Balance Over Time</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.velocity_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-warm-gray)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val) => fmt(val)}
                  contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="balance" stroke="var(--color-terracotta)" strokeWidth={2} name="Balance" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="statement_balance" stroke="var(--color-gold)" strokeWidth={1} strokeDasharray="5 5" name="Statement" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Payment Bars */}
          <Card>
            <h3 className="font-serif font-bold mb-4">Payments Made</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.velocity_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-warm-gray)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
                <Tooltip
                  formatter={(val) => fmt(val)}
                  contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="payment" fill="var(--color-sage)" name="Payment" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Utilization Over Time */}
      {analytics && analytics.utilization_data && analytics.utilization_data.length > 1 && (
        <Card>
          <h3 className="font-serif font-bold mb-4">Utilization Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={analytics.utilization_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--color-warm-gray)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" tickFormatter={v => `${v}%`} domain={[0, 100]} />
              <Tooltip
                formatter={(val) => `${val}%`}
                contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
              />
              <ReferenceLine y={30} stroke="var(--color-sage)" strokeDasharray="5 5" label={{ value: '30%', position: 'right', fill: 'var(--color-sage)', fontSize: 10 }} />
              <Line type="monotone" dataKey="utilization" stroke="var(--color-gold)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Snapshot Form */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold">Snapshots</h2>
        <Button onClick={openNewSnapshot}>+ Add Snapshot</Button>
      </div>

      {showSnapshotForm && (
        <Card>
          <h3 className="font-serif font-bold mb-4">
            {editSnapshot ? 'Edit Snapshot' : 'Record Snapshot'}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Snapshot Date">
              <input type="date" className="input-field" value={form.snapshot_date} onChange={e => handleChange('snapshot_date', e.target.value)} />
            </Field>
            <Field label="Statement Balance">
              <input type="number" step="0.01" className="input-field" placeholder="0.00" value={form.statement_balance} onChange={e => handleChange('statement_balance', e.target.value)} />
            </Field>
            <Field label="Current Balance">
              <input type="number" step="0.01" className="input-field" placeholder="0.00" value={form.current_balance} onChange={e => handleChange('current_balance', e.target.value)} />
            </Field>
            <Field label="Minimum Payment">
              <input type="number" step="0.01" className="input-field" placeholder="0.00" value={form.minimum_payment} onChange={e => handleChange('minimum_payment', e.target.value)} />
            </Field>
            <Field label="Payment Made">
              <input type="number" step="0.01" className="input-field" placeholder="0.00" value={form.payment_made} onChange={e => handleChange('payment_made', e.target.value)} />
            </Field>
            <Field label="Notes">
              <input type="text" className="input-field" placeholder="Optional" value={form.notes} onChange={e => handleChange('notes', e.target.value)} />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={saveSnapshot}>{editSnapshot ? 'Update' : 'Save'}</Button>
            <Button variant="ghost" onClick={() => setShowSnapshotForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Snapshot Table */}
      {snapshots.length === 0 ? (
        <Card>
          <p className="text-warm-gray text-center py-6">No snapshots yet. Add monthly snapshots to track your balance over time.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Date</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Statement</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Balance</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Min Due</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Payment</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...snapshots].reverse().map(snap => (
                  <tr key={snap.id} className="border-b border-card-border hover:bg-cream/30 transition-colors">
                    <td className="px-3 py-2.5">{fmtDate(snap.snapshot_date)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(snap.statement_balance)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmt(snap.current_balance)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(snap.minimum_payment)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {parseFloat(snap.payment_made) > 0 && (
                        <Badge color={parseFloat(snap.payment_made) >= parseFloat(snap.statement_balance) ? 'green' : 'orange'}>
                          {fmt(snap.payment_made)}
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openEditSnapshot(snap)} className="text-xs text-warm-gray hover:text-gold px-1">Edit</button>
                        <button onClick={() => deleteSnapshot(snap.id)} className="text-xs text-warm-gray hover:text-danger px-1">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

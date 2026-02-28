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
import BillEntryForm from '../../components/bills/BillEntryForm';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Area,
} from 'recharts';

export default function BillDetailPage() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();

  const [category, setCategory] = useState(null);
  const [bills, setBills] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState(null);

  const loadData = async () => {
    const [catRes, billsRes, analyticsRes] = await Promise.all([
      authFetch(`${API_BASE}/bill-categories/${categoryId}`),
      authFetch(`${API_BASE}/bills/category/${categoryId}`),
      authFetch(`${API_BASE}/bills/category/${categoryId}/analytics`),
    ]);
    if (catRes.ok) setCategory(await catRes.json());
    else { navigate('/bills'); return; }
    if (billsRes.ok) setBills(await billsRes.json());
    if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [categoryId]);

  const openNewBill = () => {
    setEditBill(null);
    setShowForm(true);
  };

  const openEditBill = (bill) => {
    setEditBill(bill);
    setShowForm(true);
  };

  const saveBill = async (data) => {
    const url = editBill
      ? `${API_BASE}/bills/${editBill.id}`
      : `${API_BASE}/bills`;
    const res = await authFetch(url, {
      method: editBill ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      setEditBill(null);
      loadData();
    }
  };

  const togglePaid = async (id) => {
    await authFetch(`${API_BASE}/bills/${id}/toggle-paid`, { method: 'PATCH' });
    loadData();
  };

  const deleteBill = async (id) => {
    if (!confirm('Delete this bill entry?')) return;
    await authFetch(`${API_BASE}/bills/${id}`, { method: 'DELETE' });
    loadData();
  };

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;
  if (!category) return null;

  const forecast = analytics?.forecast;
  const yoy = analytics?.yoy;
  const monthly = analytics?.monthly || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" onClick={() => navigate('/bills')} className="text-xs">
          &larr; Back
        </Button>
        <span className="text-2xl">{category.icon}</span>
        <h1 className="font-serif text-2xl font-bold">{category.name}</h1>
        <Badge color="orange">{category.cycle}</Badge>
        {category.usage_unit && (
          <span className="text-xs text-warm-gray">Tracks: {category.usage_unit}</span>
        )}
      </div>

      {/* Stats */}
      {forecast && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Next Forecast"
            value={fmt(forecast.forecast)}
            color="var(--color-gold)"
            subtitle={forecast.trend !== 0 ? `Trend: ${forecast.trend > 0 ? '+' : ''}${forecast.trend}%` : 'Stable'}
          />
          <StatCard
            label="Average"
            value={fmt(forecast.avg)}
            subtitle={`${forecast.count} bills`}
          />
          <StatCard
            label="Range"
            value={`${fmt(forecast.min)} - ${fmt(forecast.max)}`}
          />
          {yoy && yoy.previousYear.count > 0 && (
            <StatCard
              label={`${yoy.currentYear.year} vs ${yoy.previousYear.year}`}
              value={`${yoy.yoyChange > 0 ? '+' : ''}${yoy.yoyChange}%`}
              color={yoy.yoyChange > 0 ? 'var(--color-terracotta)' : 'var(--color-sage)'}
              subtitle={`${fmt(yoy.currentYear.total)} vs ${fmt(yoy.previousYear.total)}`}
            />
          )}
        </div>
      )}

      {/* Charts */}
      {monthly.length > 1 && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Cost Over Time */}
          <Card>
            <h3 className="font-serif font-bold mb-4">Monthly Cost</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-warm-gray)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
                <Tooltip
                  formatter={(val) => fmt(val)}
                  contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="total" fill="var(--color-gold)" name="Cost" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Usage Over Time (if applicable) */}
          {category.usage_unit && monthly.some(m => m.usage != null) ? (
            <Card>
              <h3 className="font-serif font-bold mb-4">{category.usage_label || 'Usage'} ({category.usage_unit})</h3>
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-warm-gray)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
                  <Tooltip
                    contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="usage" fill="var(--color-sage)" fillOpacity={0.2} stroke="var(--color-sage)" name={category.usage_unit} />
                  <Line type="monotone" dataKey="usage" stroke="var(--color-sage)" strokeWidth={2} dot={{ r: 3 }} name={category.usage_unit} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <Card>
              <h3 className="font-serif font-bold mb-4">Cost Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="var(--color-warm-gray)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--color-warm-gray)" />
                  <Tooltip
                    formatter={(val) => fmt(val)}
                    contentStyle={{ background: 'var(--color-card-bg)', border: '1px solid var(--color-card-border)', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--color-gold)" strokeWidth={2} dot={{ r: 3 }} name="Cost" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* Bill Entry Form */}
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold">Bills</h2>
        <Button onClick={openNewBill}>+ Add Bill</Button>
      </div>

      {showForm && (
        <Card>
          <h3 className="font-serif font-bold mb-4">
            {editBill ? 'Edit Bill' : 'New Bill Entry'}
          </h3>
          <BillEntryForm
            bill={editBill}
            category={category}
            onSave={saveBill}
            onCancel={() => { setShowForm(false); setEditBill(null); }}
          />
        </Card>
      )}

      {/* Bills Table */}
      {bills.length === 0 ? (
        <Card>
          <p className="text-warm-gray text-center py-6">No bills recorded yet. Add your first bill to start tracking.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Date</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Due</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Amount</th>
                  {category.usage_unit && (
                    <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">{category.usage_unit}</th>
                  )}
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Paid</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bills.map(bill => (
                  <tr key={bill.id} className="border-b border-card-border hover:bg-cream/30 transition-colors">
                    <td className="px-3 py-2.5">{fmtDate(bill.bill_date)}</td>
                    <td className="px-3 py-2.5 text-warm-gray">{bill.due_date ? fmtDate(bill.due_date) : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmt(bill.amount)}</td>
                    {category.usage_unit && (
                      <td className="px-3 py-2.5 text-right">
                        {bill.usage_amount != null ? `${bill.usage_amount} ${category.usage_unit}` : '-'}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => togglePaid(bill.id)}
                        className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center transition-all ${
                          bill.paid
                            ? 'bg-sage/20 border-sage text-sage'
                            : 'border-card-border hover:border-gold'
                        }`}
                      >
                        {bill.paid ? '\u2713' : ''}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-1">
                        <button onClick={() => openEditBill(bill)} className="text-xs text-warm-gray hover:text-gold px-1">Edit</button>
                        <button onClick={() => deleteBill(bill.id)} className="text-xs text-warm-gray hover:text-danger px-1">Del</button>
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

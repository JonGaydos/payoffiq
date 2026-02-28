import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { fmtDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Field from '../../components/ui/Field';

export default function PaymentsPage() {
  const { loanId } = useParams();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPayment, setEditPayment] = useState(null);
  const [form, setForm] = useState(getEmptyForm());

  function getEmptyForm() {
    return {
      payment_date: new Date().toISOString().split('T')[0],
      total_payment: '',
      principal: '',
      interest: '',
      escrow: '',
      extra_principal: '',
      notes: '',
    };
  }

  const loadPayments = async () => {
    const res = await authFetch(`${API_BASE}/payments/loan/${loanId}`);
    if (res.ok) setPayments(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadPayments(); }, [loanId]);

  const openNew = () => {
    setEditPayment(null);
    setForm(getEmptyForm());
    setShowForm(true);
  };

  const openEdit = (pmt) => {
    setEditPayment(pmt);
    setForm({
      payment_date: pmt.payment_date,
      total_payment: pmt.total_payment || '',
      principal: pmt.principal || '',
      interest: pmt.interest || '',
      escrow: pmt.escrow || '',
      extra_principal: pmt.extra_principal || '',
      notes: pmt.notes || '',
    });
    setShowForm(true);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Auto-calculate total payment
  const calcTotal = () => {
    const p = parseFloat(form.principal) || 0;
    const i = parseFloat(form.interest) || 0;
    const e = parseFloat(form.escrow) || 0;
    const x = parseFloat(form.extra_principal) || 0;
    return (p + i + e + x).toFixed(2);
  };

  const handleSave = async () => {
    const data = {
      ...form,
      total_payment: parseFloat(form.total_payment) || parseFloat(calcTotal()),
    };

    const url = editPayment
      ? `${API_BASE}/payments/${editPayment.id}`
      : `${API_BASE}/payments/loan/${loanId}`;
    const res = await authFetch(url, {
      method: editPayment ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      loadPayments();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this payment?')) return;
    const res = await authFetch(`${API_BASE}/payments/${id}`, { method: 'DELETE' });
    if (res.ok) loadPayments();
  };

  if (loading) return <div className="text-warm-gray text-center py-8">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold">Payment History</h2>
        <Button onClick={openNew}>+ Add Payment</Button>
      </div>

      {/* Payment Form */}
      {showForm && (
        <Card>
          <h3 className="font-serif font-bold mb-4">
            {editPayment ? 'Edit Payment' : 'Record Payment'}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Payment Date">
              <input
                type="date"
                className="input-field"
                value={form.payment_date}
                onChange={e => handleChange('payment_date', e.target.value)}
              />
            </Field>
            <Field label="Principal">
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={form.principal}
                onChange={e => handleChange('principal', e.target.value)}
              />
            </Field>
            <Field label="Interest">
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={form.interest}
                onChange={e => handleChange('interest', e.target.value)}
              />
            </Field>
            <Field label="Escrow">
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={form.escrow}
                onChange={e => handleChange('escrow', e.target.value)}
              />
            </Field>
            <Field label="Extra Principal">
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="0.00"
                value={form.extra_principal}
                onChange={e => handleChange('extra_principal', e.target.value)}
              />
            </Field>
            <Field label="Total Payment">
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder={calcTotal()}
                value={form.total_payment}
                onChange={e => handleChange('total_payment', e.target.value)}
              />
              <span className="text-[10px] text-warm-gray">Auto: {fmt(calcTotal())}</span>
            </Field>
            <Field label="Notes" className="col-span-2">
              <input
                type="text"
                className="input-field"
                placeholder="Optional notes"
                value={form.notes}
                onChange={e => handleChange('notes', e.target.value)}
              />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleSave}>
              {editPayment ? 'Update' : 'Save Payment'}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Payment Table */}
      {payments.length === 0 ? (
        <Card>
          <p className="text-warm-gray text-center py-6">No payments recorded yet.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Date</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Principal</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Interest</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Escrow</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Extra</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Total</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Balance</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-warm-gray">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(pmt => (
                  <tr key={pmt.id} className="border-b border-card-border hover:bg-cream/30 transition-colors">
                    <td className="px-3 py-2.5">{fmtDate(pmt.payment_date)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(pmt.principal)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(pmt.interest)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(pmt.escrow || 0)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {parseFloat(pmt.extra_principal) > 0 && (
                        <Badge color="green">{fmt(pmt.extra_principal)}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmt(pmt.total_payment)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{fmt(pmt.ending_balance)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => openEdit(pmt)}
                          className="text-xs text-warm-gray hover:text-gold transition-colors px-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(pmt.id)}
                          className="text-xs text-warm-gray hover:text-danger transition-colors px-1"
                        >
                          Del
                        </button>
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

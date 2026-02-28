import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { fmtDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import StatCard from '../../components/ui/StatCard';
import Field from '../../components/ui/Field';
import Badge from '../../components/ui/Badge';

export default function EscrowPage() {
  const { loanId } = useParams();
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const [account, setAccount] = useState(null);
  const [items, setItems] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [showAdjustForm, setShowAdjustForm] = useState(false);
  const [accountForm, setAccountForm] = useState({ starting_balance: '', target_balance: '', monthly_escrow: '', notes: '' });
  const [itemForm, setItemForm] = useState({ item_type: 'property_tax', description: '', amount: '', payment_date: '', year: new Date().getFullYear() });
  const [adjForm, setAdjForm] = useState({ effective_date: '', new_monthly_escrow: '', new_target_balance: '', reason: '', notes: '' });

  const loadAll = async () => {
    const [accRes, itemsRes, ledgerRes, adjRes] = await Promise.all([
      authFetch(`${API_BASE}/escrow/${loanId}/account`),
      authFetch(`${API_BASE}/escrow/${loanId}/items`),
      authFetch(`${API_BASE}/escrow/${loanId}/ledger`),
      authFetch(`${API_BASE}/escrow/${loanId}/adjustments`),
    ]);

    if (accRes.ok) {
      const data = await accRes.json();
      setAccount(data);
      if (data) {
        setAccountForm({
          starting_balance: data.starting_balance || '',
          target_balance: data.target_balance || '',
          monthly_escrow: data.monthly_escrow || '',
          notes: data.notes || '',
        });
      }
    }
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (ledgerRes.ok) {
      const ledgerData = await ledgerRes.json();
      setLedger(ledgerData.entries || []);
    }
    if (adjRes.ok) setAdjustments(await adjRes.json());
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [loanId]);

  // Account setup/update
  const saveAccount = async () => {
    const res = await authFetch(`${API_BASE}/escrow/${loanId}/account`, {
      method: 'POST',
      body: JSON.stringify(accountForm),
    });
    if (res.ok) {
      setShowAccountForm(false);
      loadAll();
    }
  };

  // Escrow item (disbursement) CRUD
  const saveItem = async () => {
    const res = await authFetch(`${API_BASE}/escrow/${loanId}/items`, {
      method: 'POST',
      body: JSON.stringify(itemForm),
    });
    if (res.ok) {
      setShowItemForm(false);
      setItemForm({ item_type: 'property_tax', description: '', amount: '', payment_date: '', year: new Date().getFullYear() });
      loadAll();
    }
  };

  const deleteItem = async (id) => {
    if (!confirm('Delete this escrow item?')) return;
    await authFetch(`${API_BASE}/escrow/${loanId}/items/${id}`, { method: 'DELETE' });
    loadAll();
  };

  // Adjustment CRUD
  const saveAdjustment = async () => {
    const res = await authFetch(`${API_BASE}/escrow/${loanId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(adjForm),
    });
    if (res.ok) {
      setShowAdjustForm(false);
      setAdjForm({ effective_date: '', new_monthly_escrow: '', new_target_balance: '', reason: '', notes: '' });
      loadAll();
    }
  };

  if (loading) return <div className="text-warm-gray text-center py-8">Loading...</div>;

  const runningBalance = ledger.length > 0 ? ledger[ledger.length - 1].running_balance : (account?.starting_balance || 0);

  return (
    <div className="space-y-6">
      <h2 className="font-serif text-lg font-bold">Escrow Account</h2>

      {/* Account Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Running Balance"
          value={fmt(runningBalance)}
          color={runningBalance >= 0 ? 'var(--color-sage)' : 'var(--color-terracotta)'}
        />
        <StatCard label="Monthly Escrow" value={fmt(account?.monthly_escrow || 0)} />
        <StatCard label="Target Balance" value={fmt(account?.target_balance || 0)} />
        <StatCard label="Starting Balance" value={fmt(account?.starting_balance || 0)} />
      </div>

      {/* Account Setup */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold">Account Settings</h3>
          <Button variant="outline" onClick={() => setShowAccountForm(!showAccountForm)}>
            {showAccountForm ? 'Cancel' : account ? 'Edit' : 'Setup'}
          </Button>
        </div>
        {showAccountForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Starting Balance">
                <input type="number" step="0.01" className="input-field" value={accountForm.starting_balance} onChange={e => setAccountForm(f => ({ ...f, starting_balance: e.target.value }))} />
              </Field>
              <Field label="Target Balance">
                <input type="number" step="0.01" className="input-field" value={accountForm.target_balance} onChange={e => setAccountForm(f => ({ ...f, target_balance: e.target.value }))} />
              </Field>
              <Field label="Monthly Escrow">
                <input type="number" step="0.01" className="input-field" value={accountForm.monthly_escrow} onChange={e => setAccountForm(f => ({ ...f, monthly_escrow: e.target.value }))} />
              </Field>
              <Field label="Notes">
                <input type="text" className="input-field" value={accountForm.notes} onChange={e => setAccountForm(f => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>
            <Button onClick={saveAccount}>Save Account</Button>
          </div>
        )}
      </Card>

      {/* Escrow Ledger */}
      <Card>
        <h3 className="font-serif font-bold mb-3">Escrow Ledger</h3>
        {ledger.length === 0 ? (
          <p className="text-warm-gray text-sm text-center py-4">No escrow transactions yet. Record payments with escrow to see the ledger.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Amount</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry, i) => (
                  <tr key={i} className="border-b border-card-border">
                    <td className="px-3 py-2">{fmtDate(entry.date)}</td>
                    <td className="px-3 py-2">
                      <Badge color={entry.type === 'deposit' ? 'green' : 'red'}>
                        {entry.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-warm-gray">{entry.description}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${entry.type === 'deposit' ? 'text-sage' : 'text-terracotta'}`}>
                      {entry.type === 'deposit' ? '+' : '-'}{fmt(Math.abs(entry.amount))}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(entry.running_balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Disbursements */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold">Disbursements</h3>
          <Button variant="outline" onClick={() => setShowItemForm(!showItemForm)}>
            {showItemForm ? 'Cancel' : '+ Add'}
          </Button>
        </div>
        {showItemForm && (
          <div className="space-y-4 mb-4 pb-4 border-b border-card-border">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Field label="Type">
                <select className="input-field" value={itemForm.item_type} onChange={e => setItemForm(f => ({ ...f, item_type: e.target.value }))}>
                  <option value="property_tax">Property Tax</option>
                  <option value="homeowners_insurance">Homeowners Insurance</option>
                  <option value="pmi">PMI</option>
                  <option value="flood_insurance">Flood Insurance</option>
                  <option value="hoa">HOA</option>
                  <option value="other">Other</option>
                </select>
              </Field>
              <Field label="Description">
                <input type="text" className="input-field" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} />
              </Field>
              <Field label="Amount">
                <input type="number" step="0.01" className="input-field" value={itemForm.amount} onChange={e => setItemForm(f => ({ ...f, amount: e.target.value }))} />
              </Field>
              <Field label="Payment Date">
                <input type="date" className="input-field" value={itemForm.payment_date} onChange={e => setItemForm(f => ({ ...f, payment_date: e.target.value }))} />
              </Field>
              <Field label="Year">
                <input type="number" className="input-field" value={itemForm.year} onChange={e => setItemForm(f => ({ ...f, year: e.target.value }))} />
              </Field>
            </div>
            <Button onClick={saveItem}>Save Disbursement</Button>
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-warm-gray text-sm text-center py-2">No disbursements recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Type</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Description</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Amount</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Date</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Year</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-card-border">
                    <td className="px-3 py-2 capitalize">{item.item_type.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2 text-warm-gray">{item.description}</td>
                    <td className="px-3 py-2 text-right font-semibold">{fmt(item.amount)}</td>
                    <td className="px-3 py-2">{fmtDate(item.payment_date)}</td>
                    <td className="px-3 py-2 text-center">{item.year}</td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => deleteItem(item.id)} className="text-xs text-warm-gray hover:text-danger">Del</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Adjustments */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif font-bold">Escrow Adjustments</h3>
          <Button variant="outline" onClick={() => setShowAdjustForm(!showAdjustForm)}>
            {showAdjustForm ? 'Cancel' : '+ Add'}
          </Button>
        </div>
        {showAdjustForm && (
          <div className="space-y-4 mb-4 pb-4 border-b border-card-border">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <Field label="Effective Date">
                <input type="date" className="input-field" value={adjForm.effective_date} onChange={e => setAdjForm(f => ({ ...f, effective_date: e.target.value }))} />
              </Field>
              <Field label="New Monthly Escrow">
                <input type="number" step="0.01" className="input-field" value={adjForm.new_monthly_escrow} onChange={e => setAdjForm(f => ({ ...f, new_monthly_escrow: e.target.value }))} />
              </Field>
              <Field label="New Target Balance">
                <input type="number" step="0.01" className="input-field" value={adjForm.new_target_balance} onChange={e => setAdjForm(f => ({ ...f, new_target_balance: e.target.value }))} />
              </Field>
              <Field label="Reason">
                <input type="text" className="input-field" value={adjForm.reason} onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))} />
              </Field>
              <Field label="Notes">
                <input type="text" className="input-field" value={adjForm.notes} onChange={e => setAdjForm(f => ({ ...f, notes: e.target.value }))} />
              </Field>
            </div>
            <Button onClick={saveAdjustment}>Save Adjustment</Button>
          </div>
        )}
        {adjustments.length === 0 ? (
          <p className="text-warm-gray text-sm text-center py-2">No adjustments recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Date</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Monthly Escrow</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Target</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-gray">Reason</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map(adj => (
                  <tr key={adj.id} className="border-b border-card-border">
                    <td className="px-3 py-2">{fmtDate(adj.effective_date)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{adj.new_monthly_escrow ? fmt(adj.new_monthly_escrow) : '-'}</td>
                    <td className="px-3 py-2 text-right">{adj.new_target_balance ? fmt(adj.new_target_balance) : '-'}</td>
                    <td className="px-3 py-2 text-warm-gray">{adj.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

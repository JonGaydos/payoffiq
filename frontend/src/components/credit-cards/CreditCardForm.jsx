import { useState } from 'react';
import Button from '../ui/Button';
import Field from '../ui/Field';

export default function CreditCardForm({ card, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: card?.name || '',
    issuer: card?.issuer || '',
    last_four: card?.last_four || '',
    credit_limit: card?.credit_limit || '',
    apr: card?.apr || '',
    min_payment_pct: card?.min_payment_pct || '1',
    min_payment_fixed: card?.min_payment_fixed || '25',
    annual_fee: card?.annual_fee || '',
    reward_type: card?.reward_type || '',
    notes: card?.notes || '',
  });

  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.credit_limit || !form.apr) {
      setError('Name, credit limit, and APR are required.');
      return;
    }
    setError('');
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-danger text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Card Name *">
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Chase Sapphire"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            required
          />
        </Field>
        <Field label="Issuer">
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Chase"
            value={form.issuer}
            onChange={e => handleChange('issuer', e.target.value)}
          />
        </Field>
        <Field label="Last 4 Digits">
          <input
            type="text"
            className="input-field"
            placeholder="1234"
            maxLength={4}
            value={form.last_four}
            onChange={e => handleChange('last_four', e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </Field>
        <Field label="Credit Limit *">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="10000"
            value={form.credit_limit}
            onChange={e => handleChange('credit_limit', e.target.value)}
            required
          />
        </Field>
        <Field label="APR (%) *">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="24.99"
            value={form.apr}
            onChange={e => handleChange('apr', e.target.value)}
            required
          />
        </Field>
        <Field label="Min Payment (%)">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="1"
            value={form.min_payment_pct}
            onChange={e => handleChange('min_payment_pct', e.target.value)}
          />
        </Field>
        <Field label="Min Payment ($)">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="25"
            value={form.min_payment_fixed}
            onChange={e => handleChange('min_payment_fixed', e.target.value)}
          />
        </Field>
        <Field label="Annual Fee">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="0"
            value={form.annual_fee}
            onChange={e => handleChange('annual_fee', e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Reward Type">
          <select
            className="input-field"
            value={form.reward_type}
            onChange={e => handleChange('reward_type', e.target.value)}
          >
            <option value="">None</option>
            <option value="cashback">Cash Back</option>
            <option value="points">Points</option>
            <option value="miles">Miles</option>
          </select>
        </Field>
        <Field label="Notes">
          <input
            type="text"
            className="input-field"
            placeholder="Optional notes"
            value={form.notes}
            onChange={e => handleChange('notes', e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">{card ? 'Update Card' : 'Create Card'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import Button from '../ui/Button';
import Field from '../ui/Field';

export default function BillEntryForm({ bill, category, onSave, onCancel }) {
  const [form, setForm] = useState({
    bill_date: bill?.bill_date || new Date().toISOString().split('T')[0],
    due_date: bill?.due_date || '',
    amount: bill?.amount || '',
    usage_amount: bill?.usage_amount || '',
    paid: bill?.paid || false,
    paid_date: bill?.paid_date || '',
    notes: bill?.notes || '',
  });
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.bill_date || form.amount === '') {
      setError('Bill date and amount are required.');
      return;
    }
    setError('');
    onSave({
      ...form,
      category_id: category.id,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-danger text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Bill Date *">
          <input
            type="date"
            className="input-field"
            value={form.bill_date}
            onChange={e => handleChange('bill_date', e.target.value)}
            required
          />
        </Field>
        <Field label="Due Date">
          <input
            type="date"
            className="input-field"
            value={form.due_date}
            onChange={e => handleChange('due_date', e.target.value)}
          />
        </Field>
        <Field label="Amount *">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="0.00"
            value={form.amount}
            onChange={e => handleChange('amount', e.target.value)}
            required
          />
        </Field>
        {category.usage_unit && (
          <Field label={category.usage_label || `Usage (${category.usage_unit})`}>
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder={`0 ${category.usage_unit}`}
              value={form.usage_amount}
              onChange={e => handleChange('usage_amount', e.target.value)}
            />
          </Field>
        )}
        <Field label="Notes">
          <input
            type="text"
            className="input-field"
            placeholder="Optional"
            value={form.notes}
            onChange={e => handleChange('notes', e.target.value)}
          />
        </Field>
        <Field label="Paid">
          <div className="flex items-center gap-3 h-10">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={e => {
                  handleChange('paid', e.target.checked);
                  if (e.target.checked && !form.paid_date) {
                    handleChange('paid_date', new Date().toISOString().split('T')[0]);
                  }
                }}
                className="w-4 h-4"
              />
              <span className="text-sm">Mark as paid</span>
            </label>
          </div>
        </Field>
        {form.paid && (
          <Field label="Paid Date">
            <input
              type="date"
              className="input-field"
              value={form.paid_date}
              onChange={e => handleChange('paid_date', e.target.value)}
            />
          </Field>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">{bill ? 'Update' : 'Add Bill'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

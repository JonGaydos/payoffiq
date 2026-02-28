import { useState } from 'react';
import Button from '../ui/Button';
import Field from '../ui/Field';

const ICONS = ['💡', '⚡', '💧', '🔥', '📡', '📱', '🗑️', '🌐', '📺', '🏠', '🚗', '💳'];
const CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'bimonthly', label: 'Bi-Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semiannual', label: 'Every 6 Months' },
  { value: 'annual', label: 'Annual' },
];

export default function CategoryForm({ category, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: category?.name || '',
    icon: category?.icon || '💡',
    usage_unit: category?.usage_unit || '',
    usage_label: category?.usage_label || '',
    cycle: category?.cycle || 'monthly',
    notes: category?.notes || '',
  });
  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) { setError('Name is required.'); return; }
    setError('');
    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-danger text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Category Name *">
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Electric"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            required
          />
        </Field>
        <Field label="Icon">
          <div className="flex gap-1 flex-wrap">
            {ICONS.map(icon => (
              <button
                key={icon}
                type="button"
                onClick={() => handleChange('icon', icon)}
                className={`w-8 h-8 rounded text-lg flex items-center justify-center transition-all ${
                  form.icon === icon ? 'bg-gold/20 ring-1 ring-gold' : 'hover:bg-cream/50'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Billing Cycle">
          <select
            className="input-field"
            value={form.cycle}
            onChange={e => handleChange('cycle', e.target.value)}
          >
            {CYCLES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Usage Unit">
          <input
            type="text"
            className="input-field"
            placeholder="e.g. kWh, gallons, therms"
            value={form.usage_unit}
            onChange={e => handleChange('usage_unit', e.target.value)}
          />
        </Field>
        <Field label="Usage Label">
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Electricity Used"
            value={form.usage_label}
            onChange={e => handleChange('usage_label', e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <input
            type="text"
            className="input-field"
            placeholder="Optional"
            value={form.notes}
            onChange={e => handleChange('notes', e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit">{category ? 'Update' : 'Create Category'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

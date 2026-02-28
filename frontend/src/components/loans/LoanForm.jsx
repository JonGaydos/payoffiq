import { useState } from 'react';
import { LOAN_TYPES } from '../../utils/constants';
import Button from '../ui/Button';
import Field from '../ui/Field';

export default function LoanForm({ loan, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: loan?.name || '',
    loan_type: loan?.loan_type || 'mortgage',
    original_amount: loan?.original_amount || '',
    interest_rate: loan?.interest_rate || '',
    loan_term_months: loan?.loan_term_months || '',
    start_date: loan?.start_date || '',
    monthly_payment: loan?.monthly_payment || '',
    current_balance: loan?.current_balance || '',
    estimated_value: loan?.estimated_value || '',
    currency: loan?.currency || 'USD',
    arm_fixed_months: loan?.arm_fixed_months || '',
    arm_rate_cap: loan?.arm_rate_cap || '',
    arm_rate_floor: loan?.arm_rate_floor || '',
    arm_periodic_cap: loan?.arm_periodic_cap || '',
  });

  const [error, setError] = useState('');

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.original_amount || !form.interest_rate || !form.loan_term_months || !form.start_date || !form.monthly_payment) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    onSave(form);
  };

  const selectedType = LOAN_TYPES.find(t => t.value === form.loan_type) || LOAN_TYPES[0];
  const isArm = form.loan_type === 'arm';

  // Term presets
  const termPresets = [
    { label: '15yr', months: 180 },
    { label: '20yr', months: 240 },
    { label: '30yr', months: 360 },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-danger text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Loan Name *">
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Home Mortgage"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            required
          />
        </Field>
        <Field label="Loan Type">
          <select
            className="input-field"
            value={form.loan_type}
            onChange={e => handleChange('loan_type', e.target.value)}
          >
            {LOAN_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Original Amount *">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="250000"
            value={form.original_amount}
            onChange={e => handleChange('original_amount', e.target.value)}
            required
          />
        </Field>
        <Field label="Interest Rate (%) *">
          <input
            type="number"
            step="0.001"
            className="input-field"
            placeholder="6.5"
            value={form.interest_rate}
            onChange={e => handleChange('interest_rate', e.target.value)}
            required
          />
        </Field>
        <Field label="Loan Term (months) *">
          <div className="flex gap-2">
            <input
              type="number"
              className="input-field flex-1"
              placeholder="360"
              value={form.loan_term_months}
              onChange={e => handleChange('loan_term_months', e.target.value)}
              required
            />
            <div className="flex gap-1">
              {termPresets.map(p => (
                <button
                  key={p.months}
                  type="button"
                  onClick={() => handleChange('loan_term_months', p.months)}
                  className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${
                    parseInt(form.loan_term_months) === p.months
                      ? 'bg-gold/20 border-gold text-gold'
                      : 'border-card-border text-warm-gray hover:border-gold'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </Field>
        <Field label="Start Date *">
          <input
            type="date"
            className="input-field"
            value={form.start_date}
            onChange={e => handleChange('start_date', e.target.value)}
            required
          />
        </Field>
        <Field label="Monthly Payment *">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="1580.17"
            value={form.monthly_payment}
            onChange={e => handleChange('monthly_payment', e.target.value)}
            required
          />
        </Field>
        <Field label="Current Balance">
          <input
            type="number"
            step="0.01"
            className="input-field"
            placeholder="Same as original if blank"
            value={form.current_balance}
            onChange={e => handleChange('current_balance', e.target.value)}
          />
        </Field>
      </div>

      {/* Asset value (for mortgage/ARM) */}
      {(form.loan_type === 'mortgage' || form.loan_type === 'arm') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Estimated Property Value">
            <input
              type="number"
              step="0.01"
              className="input-field"
              placeholder="For equity calculation"
              value={form.estimated_value}
              onChange={e => handleChange('estimated_value', e.target.value)}
            />
          </Field>
        </div>
      )}

      {/* ARM-specific fields */}
      {isArm && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-warm-gray mb-2">ARM Details</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Fixed Period (months)">
              <input
                type="number"
                className="input-field"
                placeholder="e.g. 60"
                value={form.arm_fixed_months}
                onChange={e => handleChange('arm_fixed_months', e.target.value)}
              />
            </Field>
            <Field label="Rate Cap (%)">
              <input
                type="number"
                step="0.001"
                className="input-field"
                placeholder="e.g. 9.5"
                value={form.arm_rate_cap}
                onChange={e => handleChange('arm_rate_cap', e.target.value)}
              />
            </Field>
            <Field label="Rate Floor (%)">
              <input
                type="number"
                step="0.001"
                className="input-field"
                placeholder="e.g. 3.5"
                value={form.arm_rate_floor}
                onChange={e => handleChange('arm_rate_floor', e.target.value)}
              />
            </Field>
            <Field label="Periodic Cap (%)">
              <input
                type="number"
                step="0.001"
                className="input-field"
                placeholder="e.g. 2.0"
                value={form.arm_periodic_cap}
                onChange={e => handleChange('arm_periodic_cap', e.target.value)}
              />
            </Field>
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit">{loan ? 'Update Loan' : 'Create Loan'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const API = '/api';

const fmt = (n) => n != null ? parseFloat(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
const fmtDate = (d) => {
  if (!d) return '—';
  const p = String(d).split('T')[0].split('-');
  return new Date(p[0], p[1]-1, p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtMonths = (m) => {
  const y = Math.floor(m / 12), mo = m % 12;
  return [y > 0 && `${y}yr`, mo > 0 && `${mo}mo`].filter(Boolean).join(' ');
};

// ─── STYLES ──────────────────────────────────────────────────────────────────

const s = {
  app: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 240, background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)', display: 'flex',
    flexDirection: 'column', padding: '0 0 24px', flexShrink: 0,
    position: 'sticky', top: 0, height: '100vh', overflow: 'auto'
  },
  logo: { padding: '28px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 8 },
  logoTitle: { fontSize: 22, color: 'var(--gold-light)', fontFamily: "'DM Serif Display', serif" },
  logoSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, letterSpacing: '0.08em', textTransform: 'uppercase' },
  navSection: { padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 },
  navItem: (active) => ({
    padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10,
    cursor: 'pointer', borderRadius: 8, margin: '1px 8px',
    background: active ? 'rgba(201,151,58,0.15)' : 'transparent',
    color: active ? 'var(--gold-light)' : 'rgba(255,255,255,0.65)',
    fontSize: 14, fontWeight: active ? 600 : 400,
    borderLeft: active ? '3px solid var(--gold)' : '3px solid transparent',
  }),
  loanPicker: { padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' },
  loanPickerLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 },
  select: {
    width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: 'var(--sidebar-text)', fontSize: 13
  },
  main: { flex: 1, padding: '32px 40px', overflow: 'auto', background: 'var(--cream)' },
  pageHeader: { marginBottom: 28 },
  pageTitle: { fontSize: 28, color: 'var(--ink)' },
  pageSub: { color: 'var(--warm-gray)', marginTop: 4, fontSize: 14 },
  grid: (cols) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }),
  card: {
    background: 'var(--card)', borderRadius: 'var(--radius)', padding: '20px 24px',
    boxShadow: 'var(--shadow)', border: '1px solid var(--border)'
  },
  statCard: (color) => ({
    background: 'var(--card)', borderRadius: 'var(--radius)', padding: '20px 24px',
    boxShadow: 'var(--shadow)', border: '1px solid var(--border)',
    borderTop: `3px solid ${color || 'var(--gold)'}`,
  }),
  statLabel: { fontSize: 12, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  statValue: { fontSize: 26, fontFamily: "'DM Serif Display', serif", marginTop: 4, color: 'var(--ink)' },
  statSub: { fontSize: 12, color: 'var(--warm-gray)', marginTop: 4 },
  sectionTitle: { fontSize: 18, marginBottom: 16, color: 'var(--ink)' },
  btn: (variant) => ({
    padding: variant === 'sm' ? '7px 14px' : '10px 20px',
    fontSize: variant === 'sm' ? 13 : 14,
    fontWeight: 500, borderRadius: 8, border: 'none', cursor: 'pointer',
    background: variant === 'danger' ? 'var(--terracotta)' :
                variant === 'ghost' ? 'transparent' :
                variant === 'outline' ? 'transparent' : 'var(--gold)',
    color: variant === 'ghost' ? 'var(--warm-gray)' :
           variant === 'outline' ? 'var(--gold)' : 'white',
    border: variant === 'outline' ? '1px solid var(--gold)' :
            variant === 'ghost' ? '1px solid var(--border)' : 'none',
  }),
  input: {
    padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 14, background: 'var(--surface)', color: 'var(--ink)', width: '100%', outline: 'none',
  },
  label: { fontSize: 12, color: 'var(--warm-gray)', marginBottom: 5, display: 'block', fontWeight: 500 },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', color: 'var(--warm-gray)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', color: 'var(--ink)' },
  badge: (color) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11,
    background: color === 'green' ? '#E8F5E9' : color === 'orange' ? '#FFF3E0' : color === 'blue' ? '#E3F2FD' : '#F3E5F5',
    color: color === 'green' ? 'var(--sage)' : color === 'orange' ? 'var(--terracotta)' : color === 'blue' ? '#1565C0' : '#6A1B9A',
    fontWeight: 600,
  }),
  uploadZone: {
    border: '2px dashed var(--gold)', borderRadius: 'var(--radius)', padding: '32px',
    textAlign: 'center', cursor: 'pointer', background: 'rgba(201,151,58,0.04)',
  },
};

function Field({ label, children }) {
  return <div><label style={s.label}>{label}</label>{children}</div>;
}

// ─── LOAN FORM ────────────────────────────────────────────────────────────────

function LoanForm({ initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    original_amount: initial.original_amount || '',
    interest_rate: initial.interest_rate || '',
    loan_term_months: initial.loan_term_months || 360,
    start_date: initial.start_date ? initial.start_date.split('T')[0] : '',
    monthly_payment: initial.monthly_payment || '',
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const calcPayment = () => {
    const P = parseFloat(form.original_amount);
    const r = parseFloat(form.interest_rate) / 100 / 12;
    const n = parseInt(form.loan_term_months);
    if (P && r && n) {
      const mp = P * r * Math.pow(1+r, n) / (Math.pow(1+r, n) - 1);
      setForm(f => ({ ...f, monthly_payment: mp.toFixed(2) }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label="Loan Nickname">
        <input style={s.input} value={form.name} onChange={set('name')} placeholder="e.g. Primary Home" />
      </Field>
      <div style={s.formGrid}>
        <Field label="Original Loan Amount ($)">
          <input style={s.input} type="number" value={form.original_amount} onChange={set('original_amount')} placeholder="350000" />
        </Field>
        <Field label="Interest Rate (%)">
          <input style={s.input} type="number" step="0.001" value={form.interest_rate} onChange={set('interest_rate')} placeholder="6.750" />
        </Field>
        <Field label="Loan Term">
          <select style={s.input} value={form.loan_term_months} onChange={set('loan_term_months')}>
            <option value={180}>15 Years</option>
            <option value={240}>20 Years</option>
            <option value={360}>30 Years</option>
          </select>
        </Field>
        <Field label="Start Date">
          <input style={s.input} type="date" value={form.start_date} onChange={set('start_date')} />
        </Field>
      </div>
      <Field label="Monthly Payment (P+I)">
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={s.input} type="number" value={form.monthly_payment} onChange={set('monthly_payment')} placeholder="Auto-calculate →" />
          <button style={s.btn('outline')} onClick={calcPayment}>Calc</button>
        </div>
      </Field>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, justifyContent: 'flex-end' }}>
        <button style={s.btn('ghost')} onClick={onCancel}>Cancel</button>
        <button style={s.btn()} onClick={() => onSave(form)}>Save Loan</button>
      </div>
    </div>
  );
}

// ─── PAYMENT FORM ─────────────────────────────────────────────────────────────

function PaymentForm({ loanId, initial = {}, onSave, onCancel }) {
  const [form, setForm] = useState({
    payment_date: initial.payment_date ? initial.payment_date.split('T')[0] : new Date().toISOString().split('T')[0],
    total_payment: initial.total_payment || '',
    principal: initial.principal || '',
    interest: initial.interest || '',
    escrow: initial.escrow || '',
    extra_principal: initial.extra_principal || '0',
    ending_balance: initial.ending_balance || '',
    statement_month: initial.statement_month || '',
    notes: initial.notes || '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [provider, setProvider] = useState('claude');

  const PROVIDERS = [
    { id: 'claude',  label: 'Claude (Anthropic)' },
    { id: 'openai',  label: 'ChatGPT (OpenAI)' },
    { id: 'gemini',  label: 'Gemini (Google)' },
    { id: 'copilot', label: 'Copilot (Microsoft)' },
  ];

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const autoCalcTotal = () => {
    const total = (parseFloat(form.principal)||0) + (parseFloat(form.interest)||0) + (parseFloat(form.escrow)||0) + (parseFloat(form.extra_principal)||0);
    setForm(f => ({ ...f, total_payment: total.toFixed(2) }));
  };

  const processPDF = async (file) => {
    setUploading(true);
    setUploadResult(null);
    const fd = new FormData();
    fd.append('pdf', file);
    fd.append('provider', provider);
    try {
      const r = await fetch(`${API}/loans/${loanId}/process-pdf`, { method: 'POST', body: fd });
      const data = await r.json();
      if (data.success) {
        const e = data.extracted;
        setUploadResult('✓ Data extracted from statement — please review before saving');
        setForm(f => ({
          ...f,
          payment_date: e.payment_date || f.payment_date,
          statement_month: e.statement_month || f.statement_month,
          total_payment: e.total_payment || f.total_payment,
          principal: e.principal || f.principal,
          interest: e.interest || f.interest,
          escrow: e.escrow || f.escrow,
          extra_principal: e.extra_principal || f.extra_principal || '0',
          ending_balance: e.ending_balance || f.ending_balance,
          notes: e.notes || f.notes,
        }));
      } else {
        setUploadResult('⚠ ' + data.error);
      }
    } catch (err) {
      setUploadResult('⚠ Processing failed: ' + err.message);
    }
    setUploading(false);
  };

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); processPDF(e.dataTransfer.files[0]); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{ ...s.uploadZone, background: dragOver ? 'rgba(201,151,58,0.1)' : 'rgba(201,151,58,0.04)' }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('pdfInput').click()}
      >
        <input id="pdfInput" type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => processPDF(e.target.files[0])} />
        {uploading ? (
          <div style={{ color: 'var(--gold)' }}>🔄 Processing with {PROVIDERS.find(p => p.id === provider)?.label}...</div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>Drop mortgage statement PDF or click to upload</div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 4 }}>AI will extract payment data automatically (requires API key in Settings)</div>
          </>
        )}
      </div>
      {uploadResult && (
        <div style={{ padding: '8px 12px', background: uploadResult.startsWith('✓') ? '#E8F5E9' : '#FFF3E0', borderRadius: 8, fontSize: 13, color: uploadResult.startsWith('✓') ? 'var(--sage)' : 'var(--terracotta)' }}>
          {uploadResult}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>AI Provider:</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          style={{ flex: 1, padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer', outline: 'none' }}
        >
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <span style={{ fontSize: 12, color: 'var(--warm-gray)', whiteSpace: 'nowrap' }}>Add keys in ⚙️ Settings</span>
      </div>
      <div style={s.formGrid}>
        <Field label="Payment Date">
          <input style={s.input} type="date" value={form.payment_date} onChange={set('payment_date')} />
        </Field>
        <Field label="Statement Month">
          <input style={s.input} type="month" value={form.statement_month} onChange={set('statement_month')} />
        </Field>
        <Field label="Principal ($)">
          <input style={s.input} type="number" value={form.principal} onChange={set('principal')} />
        </Field>
        <Field label="Interest ($)">
          <input style={s.input} type="number" value={form.interest} onChange={set('interest')} />
        </Field>
        <Field label="Escrow ($)">
          <input style={s.input} type="number" value={form.escrow} onChange={set('escrow')} />
        </Field>
        <Field label="Extra Principal ($)">
          <input style={s.input} type="number" value={form.extra_principal} onChange={set('extra_principal')} />
        </Field>
        <Field label="Ending Balance ($)">
          <input style={s.input} type="number" value={form.ending_balance} onChange={set('ending_balance')} />
        </Field>
        <Field label="Total Payment ($)">
          <div style={{ display: 'flex', gap: 6 }}>
            <input style={s.input} type="number" value={form.total_payment} onChange={set('total_payment')} />
            <button style={s.btn('outline')} onClick={autoCalcTotal}>Calc</button>
          </div>
        </Field>
      </div>
      <Field label="Notes">
        <textarea style={{ ...s.input, height: 60, resize: 'vertical' }} value={form.notes} onChange={set('notes')} />
      </Field>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={s.btn('ghost')} onClick={onCancel}>Cancel</button>
        <button style={s.btn()} onClick={() => onSave(form)}>Save Payment</button>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ selectedLoan, analytics, payments }) {
  if (!selectedLoan || !analytics) {
    return (
      <div>
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>Welcome to MortgageIQ</h1>
          <p style={s.pageSub}>Select or create a loan to get started</p>
        </div>
        <div style={{ ...s.card, textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", marginBottom: 8, color: 'var(--ink)' }}>No Loan Selected</h2>
          <p style={{ color: 'var(--warm-gray)' }}>Go to Manage Loans in the sidebar to add your first mortgage</p>
        </div>
      </div>
    );
  }

  const a = analytics;
  const loan = a.loan;
  const progress = ((parseFloat(loan.original_amount) - a.currentBalance) / parseFloat(loan.original_amount)) * 100;

  const chartData = payments.map((p, i) => ({
    month: p.statement_month || `#${i+1}`,
    principal: parseFloat(p.principal),
    interest: parseFloat(p.interest),
    escrow: parseFloat(p.escrow),
    extra: parseFloat(p.extra_principal),
    balance: parseFloat(p.ending_balance || 0),
  })).slice(-24);

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>{loan.name}</h1>
        <p style={s.pageSub}>{parseFloat(loan.interest_rate)}% · {parseInt(loan.loan_term_months)/12} Year · Started {fmtDate(loan.start_date)}</p>
      </div>

      <div style={{ ...s.card, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Loan Payoff Progress</span>
          <span style={{ fontSize: 22, fontFamily: "'DM Serif Display', serif", color: 'var(--gold)' }}>{progress.toFixed(1)}%</span>
        </div>
        <div style={{ height: 12, borderRadius: 6, background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(progress, 100)}%`, height: '100%', background: 'linear-gradient(to right, var(--gold), var(--gold-light))', borderRadius: 6 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--warm-gray)' }}>
          <span>{fmt(parseFloat(loan.original_amount) - a.currentBalance)} paid</span>
          <span>{fmt(a.currentBalance)} remaining</span>
        </div>
      </div>

      <div style={{ ...s.grid(4), marginBottom: 20 }}>
        <div style={s.statCard('var(--gold)')}>
          <div style={s.statLabel}>Current Balance</div>
          <div style={s.statValue}>{fmt(a.currentBalance)}</div>
          <div style={s.statSub}>{fmt(loan.original_amount)} original</div>
        </div>
        <div style={s.statCard('var(--sage)')}>
          <div style={s.statLabel}>Projected Payoff</div>
          <div style={s.statValue}>{fmtDate(a.projectedPayoffDate)}</div>
          <div style={s.statSub}>{fmtMonths(a.projectedMonths)} remaining</div>
        </div>
        <div style={s.statCard('var(--terracotta)')}>
          <div style={s.statLabel}>Total Interest Paid</div>
          <div style={s.statValue}>{fmt(a.totalInterestPaid)}</div>
          <div style={s.statSub}>{fmt(a.projectedRemainingInterest)} projected remaining</div>
        </div>
        <div style={s.statCard('#5C8DC4')}>
          <div style={s.statLabel}>Total Escrow Paid</div>
          <div style={s.statValue}>{fmt(a.totalEscrowPaid)}</div>
          <div style={s.statSub}>{a.paymentCount} payments logged</div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ ...s.grid(2), marginBottom: 20 }}>
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Payment Breakdown</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--warm-gray)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--warm-gray)' }} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
                <Legend />
                <Bar dataKey="principal" fill="var(--gold)" name="Principal" stackId="a" />
                <Bar dataKey="interest" fill="var(--terracotta)" name="Interest" stackId="a" />
                <Bar dataKey="escrow" fill="#5C8DC4" name="Escrow" stackId="a" />
                <Bar dataKey="extra" fill="var(--sage)" name="Extra" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={s.card}>
            <h3 style={s.sectionTitle}>Balance Over Time</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--gold)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--warm-gray)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--warm-gray)' }} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
                <Area type="monotone" dataKey="balance" stroke="var(--gold)" fill="url(#balGrad)" name="Balance" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div style={s.card}>
        <h3 style={s.sectionTitle}>Loan Summary</h3>
        <div style={s.grid(3)}>
          {[
            ['Monthly Payment', fmt(loan.monthly_payment)],
            ['Payments Made', a.paymentCount],
            ['Months Ahead of Schedule', a.monthsAhead > 0 ? `${a.monthsAhead} months` : 'On track'],
            ['Total Paid', fmt(a.totalPaid)],
            ['Total Principal Paid', fmt(a.totalPrincipalPaid)],
            ['Original Total Interest', fmt(a.originalTotalInterest)],
          ].map(([l, v]) => (
            <div key={l} style={{ padding: '12px', background: 'var(--surface)', borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
              <div style={{ fontSize: 18, fontFamily: "'DM Serif Display', serif", marginTop: 2, color: 'var(--ink)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PAYMENTS VIEW ────────────────────────────────────────────────────────────

function PaymentsView({ loan, payments, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editPayment, setEditPayment] = useState(null);

  const savePayment = async (form) => {
    const method = editPayment ? 'PUT' : 'POST';
    const url = editPayment ? `${API}/payments/${editPayment.id}` : `${API}/loans/${loan.id}/payments`;
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowForm(false);
    setEditPayment(null);
    onRefresh();
  };

  const deletePayment = async (id) => {
    if (confirm('Delete this payment? The dashboard balance will update automatically.')) {
      await fetch(`${API}/payments/${id}`, { method: 'DELETE' });
      onRefresh();
    }
  };

  if (!loan) return <div style={s.card}><p style={{ color: 'var(--warm-gray)' }}>Select a loan first</p></div>;

  const sorted = [...payments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

  return (
    <div>
      <div style={{ ...s.pageHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={s.pageTitle}>Payment History</h1>
          <p style={s.pageSub}>{payments.length} payments recorded for {loan.name}</p>
        </div>
        <button style={s.btn()} onClick={() => { setEditPayment(null); setShowForm(true); }}>+ Add Payment</button>
      </div>

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ ...s.sectionTitle, marginBottom: 20 }}>{editPayment ? 'Edit Payment' : 'Add Payment'}</h3>
          <PaymentForm
            loanId={loan.id}
            initial={editPayment || {}}
            onSave={savePayment}
            onCancel={() => { setShowForm(false); setEditPayment(null); }}
          />
        </div>
      )}

      <div style={s.card}>
        {payments.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--warm-gray)' }}>
            No payments logged yet. Click "+ Add Payment" to get started.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Date', 'Total', 'Principal', 'Interest', 'Escrow', 'Extra', 'Balance', ''].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(p => (
                  <tr key={p.id}>
                    <td style={s.td}>{fmtDate(p.payment_date)}</td>
                    <td style={{ ...s.td, fontWeight: 600 }}>{fmt(p.total_payment)}</td>
                    <td style={{ ...s.td, color: 'var(--gold)' }}>{fmt(p.principal)}</td>
                    <td style={{ ...s.td, color: 'var(--terracotta)' }}>{fmt(p.interest)}</td>
                    <td style={{ ...s.td, color: '#5C8DC4' }}>{fmt(p.escrow)}</td>
                    <td style={{ ...s.td, color: 'var(--sage)' }}>{fmt(p.extra_principal)}</td>
                    <td style={s.td}>{fmt(p.ending_balance)}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={s.btn('sm')} onClick={() => { setEditPayment(p); setShowForm(true); window.scrollTo(0,0); }}>Edit</button>
                        <button style={{ ...s.btn('sm'), background: '#FEF3F0', color: 'var(--terracotta)' }} onClick={() => deletePayment(p.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CALCULATOR ───────────────────────────────────────────────────────────────

function ScenarioResult({ label, color, scenario, savings }) {
  if (!scenario) return null;
  const isBase = !savings;
  return (
    <div style={{
      borderRadius: 10, padding: 16,
      background: isBase ? 'var(--surface)' : color + '18',
      border: `1px solid ${isBase ? 'var(--border)' : color + '44'}`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: isBase ? 'var(--warm-gray)' : color, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: isBase ? 'var(--ink)' : color }}>
        {fmtDate(scenario.payoffDate)}
      </div>
      <div style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 3 }}>
        {fmtMonths(scenario.months)} remaining · {fmt(scenario.totalInterest)} total interest
      </div>
      {savings && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color}33`, display: 'flex', gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Time saved</div>
            <div style={{ fontSize: 15, fontWeight: 600, color }}>{fmtMonths(savings.months)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--warm-gray)' }}>Interest saved</div>
            <div style={{ fontSize: 15, fontWeight: 600, color }}>{fmt(savings.interest)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Calculator({ loan }) {
  const [extraMonthly, setExtraMonthly] = useState('');
  const [lumpSum, setLumpSum] = useState('');
  const [result, setResult] = useState(null);
  const [amortize, setAmortize] = useState([]);
  const [showAmort, setShowAmort] = useState(false);
  const [amortScenario, setAmortScenario] = useState('base');

  const calculate = async () => {
    const r = await fetch(`${API}/loans/${loan.id}/calculate-payoff`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extra_monthly: parseFloat(extraMonthly) || 0, lump_sum: parseFloat(lumpSum) || 0 })
    });
    setResult(await r.json());
    setShowAmort(false);
  };

  const buildAmort = (scenario) => {
    if (!loan) return;
    const startBalance = scenario === 'base' || scenario === 'monthly'
      ? parseFloat(loan.current_balance || loan.original_amount)
      : Math.max(0, parseFloat(loan.current_balance || loan.original_amount) - (parseFloat(lumpSum) || 0));
    const monthlyExtra = (scenario === 'monthly' || scenario === 'combined') ? (parseFloat(extraMonthly) || 0) : 0;
    const r = parseFloat(loan.interest_rate) / 100 / 12;
    const payment = parseFloat(loan.monthly_payment) + monthlyExtra;
    let balance = startBalance;
    const rows = [];
    let month = 0;
    while (balance > 0.01 && month < 600) {
      month++;
      const interest = balance * r;
      const principal = Math.min(payment - interest, balance);
      balance = Math.max(0, balance - principal);
      rows.push({ month, interest: interest.toFixed(2), principal: principal.toFixed(2), balance: balance.toFixed(2) });
    }
    setAmortize(rows);
    setAmortScenario(scenario);
    setShowAmort(true);
  };

  if (!loan) return <div style={s.card}><p style={{ color: 'var(--warm-gray)' }}>Select a loan first</p></div>;

  const hasMonthly = parseFloat(extraMonthly) > 0;
  const hasLump = parseFloat(lumpSum) > 0;

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Payoff Calculator</h1>
        <p style={s.pageSub}>See how extra payments affect your payoff date and total interest</p>
      </div>

      <div style={{ ...s.card, marginBottom: 20 }}>
        <h3 style={{ ...s.sectionTitle, marginBottom: 4 }}>Enter Your Scenarios</h3>
        <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
          Fill in one or both fields — results will show all applicable scenarios side by side.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'flex-end' }}>
          <Field label="Extra Monthly Payment ($)">
            <input style={s.input} type="number" min="0" value={extraMonthly} onChange={(e) => setExtraMonthly(e.target.value)} placeholder="e.g. 200" />
          </Field>
          <Field label="One-Time Lump Sum to Principal ($)">
            <input style={s.input} type="number" min="0" value={lumpSum} onChange={(e) => setLumpSum(e.target.value)} placeholder="e.g. 5000" />
          </Field>
          <button style={{ ...s.btn(), padding: '9px 28px', whiteSpace: 'nowrap' }} onClick={calculate}>Calculate</button>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: 'var(--warm-gray)' }}>
          Current balance: <strong>{fmt(loan.current_balance || loan.original_amount)}</strong> · Monthly payment: <strong>{fmt(loan.monthly_payment)}</strong> · Rate: <strong>{loan.interest_rate}%</strong>
        </div>
      </div>

      {result && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>Results</h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${1 + (hasMonthly ? 1 : 0) + (hasLump ? 1 : 0) + (hasMonthly && hasLump ? 1 : 0)}, 1fr)`, gap: 12 }}>
            <ScenarioResult label="Baseline (no changes)" scenario={result.base} />
            {hasMonthly && <ScenarioResult label={`+${fmt(extraMonthly)}/mo extra`} color="var(--sage)" scenario={result.monthly} savings={result.savings.monthly} />}
            {hasLump && <ScenarioResult label={`${fmt(lumpSum)} lump sum now`} color="var(--gold)" scenario={result.lump} savings={result.savings.lump} />}
            {hasMonthly && hasLump && <ScenarioResult label={`Lump sum + ${fmt(extraMonthly)}/mo`} color="var(--terracotta)" scenario={result.combined} savings={result.savings.combined} />}
          </div>
        </div>
      )}

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAmort ? 16 : 0, flexWrap: 'wrap', gap: 10 }}>
          <h3 style={s.sectionTitle}>Amortization Schedule</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {showAmort && <button style={s.btn('ghost')} onClick={() => setShowAmort(false)}>Hide</button>}
            <button style={s.btn('outline')} onClick={() => buildAmort('base')}>Baseline</button>
            {result && hasMonthly && <button style={{ ...s.btn('outline'), borderColor: 'var(--sage)', color: 'var(--sage)' }} onClick={() => buildAmort('monthly')}>+{fmt(extraMonthly)}/mo</button>}
            {result && hasLump && <button style={{ ...s.btn('outline'), borderColor: 'var(--gold)', color: 'var(--gold)' }} onClick={() => buildAmort('lump')}>Lump Sum</button>}
            {result && hasMonthly && hasLump && <button style={{ ...s.btn('outline'), borderColor: 'var(--terracotta)', color: 'var(--terracotta)' }} onClick={() => buildAmort('combined')}>Combined</button>}
          </div>
        </div>
        {showAmort && (
          <>
            <div style={{ fontSize: 12, color: 'var(--warm-gray)', marginBottom: 12 }}>
              Showing: <strong>{amortScenario === 'base' ? 'Baseline' : amortScenario === 'monthly' ? `+${fmt(extraMonthly)}/mo` : amortScenario === 'lump' ? `${fmt(lumpSum)} lump sum` : 'Combined'}</strong> — {amortize.length} months total
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 400 }}>
              <table style={s.table}>
                <thead>
                  <tr>{['Month', 'Principal', 'Interest', 'Remaining Balance'].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {amortize.map((row) => (
                    <tr key={row.month}>
                      <td style={s.td}>{row.month}</td>
                      <td style={{ ...s.td, color: 'var(--gold)' }}>{fmt(row.principal)}</td>
                      <td style={{ ...s.td, color: 'var(--terracotta)' }}>{fmt(row.interest)}</td>
                      <td style={s.td}>{fmt(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!showAmort && <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginTop: 8 }}>Click a scenario button above to view its full month-by-month amortization table.</p>}
      </div>
    </div>
  );
}

// ─── ESCROW VIEW ──────────────────────────────────────────────────────────────

function EscrowView({ loan }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ item_type: 'tax', description: '', amount: '', payment_date: '', year: new Date().getFullYear() });

  useEffect(() => {
    if (loan) fetch(`${API}/loans/${loan.id}/escrow`).then(r => r.json()).then(setItems);
  }, [loan]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    await fetch(`${API}/loans/${loan.id}/escrow`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    setShowForm(false);
    fetch(`${API}/loans/${loan.id}/escrow`).then(r => r.json()).then(setItems);
  };

  const del = async (id) => {
    if (confirm('Delete this escrow item?')) {
      await fetch(`${API}/escrow/${id}`, { method: 'DELETE' });
      fetch(`${API}/loans/${loan.id}/escrow`).then(r => r.json()).then(setItems);
    }
  };

  const taxes = items.filter(i => i.item_type === 'tax');
  const insurance = items.filter(i => i.item_type === 'insurance');
  const totalTax = taxes.reduce((s, i) => s + parseFloat(i.amount), 0);
  const totalIns = insurance.reduce((s, i) => s + parseFloat(i.amount), 0);

  if (!loan) return <div style={s.card}><p style={{ color: 'var(--warm-gray)' }}>Select a loan first</p></div>;

  return (
    <div>
      <div style={{ ...s.pageHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={s.pageTitle}>Escrow Tracker</h1>
          <p style={s.pageSub}>Track tax and insurance disbursements from your escrow account</p>
        </div>
        <button style={s.btn()} onClick={() => setShowForm(!showForm)}>+ Add Item</button>
      </div>

      <div style={{ ...s.grid(2), marginBottom: 20 }}>
        <div style={s.statCard('var(--terracotta)')}>
          <div style={s.statLabel}>Total Taxes Paid</div>
          <div style={s.statValue}>{fmt(totalTax)}</div>
          <div style={s.statSub}>{taxes.length} disbursements</div>
        </div>
        <div style={s.statCard('#5C8DC4')}>
          <div style={s.statLabel}>Total Insurance Paid</div>
          <div style={s.statValue}>{fmt(totalIns)}</div>
          <div style={s.statSub}>{insurance.length} disbursements</div>
        </div>
      </div>

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>Add Escrow Item</h3>
          <div style={s.formGrid}>
            <Field label="Type">
              <select style={s.input} value={form.item_type} onChange={set('item_type')}>
                <option value="tax">Property Tax</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Amount ($)">
              <input style={s.input} type="number" value={form.amount} onChange={set('amount')} />
            </Field>
            <Field label="Payment Date">
              <input style={s.input} type="date" value={form.payment_date} onChange={set('payment_date')} />
            </Field>
            <Field label="Year">
              <input style={s.input} type="number" value={form.year} onChange={set('year')} />
            </Field>
          </div>
          <Field label="Description">
            <input style={{ ...s.input, marginTop: 12 }} value={form.description} onChange={set('description')} placeholder="e.g. County property tax Q2" />
          </Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button style={s.btn('ghost')} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={s.btn()} onClick={save}>Save Item</button>
          </div>
        </div>
      )}

      <div style={s.card}>
        {items.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--warm-gray)' }}>No escrow items logged yet.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>{['Date', 'Type', 'Description', 'Year', 'Amount', ''].map(h => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...items].reverse().map(item => (
                <tr key={item.id}>
                  <td style={s.td}>{fmtDate(item.payment_date)}</td>
                  <td style={s.td}>
                    <span style={s.badge(item.item_type === 'tax' ? 'orange' : item.item_type === 'insurance' ? 'blue' : 'green')}>
                      {item.item_type === 'tax' ? 'Tax' : item.item_type === 'insurance' ? 'Insurance' : 'Other'}
                    </span>
                  </td>
                  <td style={s.td}>{item.description}</td>
                  <td style={s.td}>{item.year}</td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{fmt(item.amount)}</td>
                  <td style={s.td}>
                    <button style={{ ...s.btn('sm'), background: '#FEF3F0', color: 'var(--terracotta)' }} onClick={() => del(item.id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── LOANS MANAGER ────────────────────────────────────────────────────────────

function LoansManager({ loans, onRefresh, onSelect }) {
  const [showForm, setShowForm] = useState(false);
  const [editLoan, setEditLoan] = useState(null);

  const save = async (form) => {
    const method = editLoan ? 'PUT' : 'POST';
    const url = editLoan ? `${API}/loans/${editLoan.id}` : `${API}/loans`;
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const loan = await r.json();
    setShowForm(false);
    setEditLoan(null);
    onRefresh();
    if (!editLoan) onSelect(loan);
  };

  const del = async (id) => {
    if (confirm('Delete this loan and ALL its payment history? This cannot be undone.')) {
      await fetch(`${API}/loans/${id}`, { method: 'DELETE' });
      onRefresh();
    }
  };

  return (
    <div>
      <div style={{ ...s.pageHeader, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={s.pageTitle}>Manage Loans</h1>
          <p style={s.pageSub}>Add and manage your mortgage loans</p>
        </div>
        <button style={s.btn()} onClick={() => { setEditLoan(null); setShowForm(true); }}>+ New Loan</button>
      </div>

      {showForm && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ ...s.sectionTitle, marginBottom: 16 }}>{editLoan ? 'Edit Loan' : 'Add New Loan'}</h3>
          <LoanForm initial={editLoan || {}} onSave={save} onCancel={() => { setShowForm(false); setEditLoan(null); }} />
        </div>
      )}

      {loans.length === 0 && !showForm && (
        <div style={{ ...s.card, textAlign: 'center', padding: '60px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏡</div>
          <h3 style={{ fontFamily: "'DM Serif Display', serif", marginBottom: 8, color: 'var(--ink)' }}>No Loans Yet</h3>
          <p style={{ color: 'var(--warm-gray)', marginBottom: 20 }}>Add your first mortgage to start tracking</p>
          <button style={s.btn()} onClick={() => setShowForm(true)}>Add Your First Loan</button>
        </div>
      )}

      {loans.map(loan => (
        <div key={loan.id} style={{ ...s.card, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 4, color: 'var(--ink)' }}>{loan.name}</div>
            <div style={{ fontSize: 13, color: 'var(--warm-gray)' }}>
              {fmt(loan.original_amount)} · {parseFloat(loan.interest_rate)}% · {parseInt(loan.loan_term_months)/12}yr · Started {fmtDate(loan.start_date)}
            </div>
            <div style={{ fontSize: 13, marginTop: 4, color: 'var(--ink)' }}>
              Balance: <strong>{fmt(loan.current_balance || loan.original_amount)}</strong> · Monthly: <strong>{fmt(loan.monthly_payment)}</strong>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={s.btn('outline')} onClick={() => onSelect(loan)}>View</button>
            <button style={s.btn('ghost')} onClick={() => { setEditLoan(loan); setShowForm(true); window.scrollTo(0,0); }}>Edit</button>
            <button style={{ ...s.btn('sm'), background: '#FEF3F0', color: 'var(--terracotta)' }} onClick={() => del(loan.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

function Settings({ theme, setTheme }) {
  const PROVIDERS = [
    { id: 'claude_api_key',  label: 'Claude (Anthropic)',  placeholder: 'sk-ant-api03-...', link: 'https://console.anthropic.com/api-keys', linkLabel: 'Get key →' },
    { id: 'openai_api_key',  label: 'ChatGPT (OpenAI)',    placeholder: 'sk-proj-...', link: 'https://platform.openai.com/api-keys', linkLabel: 'Get key →' },
    { id: 'gemini_api_key',  label: 'Gemini (Google)',     placeholder: 'AIza...', link: 'https://aistudio.google.com/app/apikey', linkLabel: 'Get key →' },
    { id: 'copilot_api_key', label: 'Copilot (Microsoft)', placeholder: 'GitHub PAT or Azure key', link: 'https://github.com/settings/tokens', linkLabel: 'Get key →' },
  ];

  const THEMES = [
    { id: 'light', label: '☀️ Light', desc: 'Warm cream' },
    { id: 'dark',  label: '🌙 Dark',  desc: 'Dark navy' },
    { id: 'slate', label: '🌊 Slate', desc: 'Cool blue' },
  ];

  const [keys, setKeys] = useState({ claude_api_key: '', openai_api_key: '', gemini_api_key: '', copilot_api_key: '' });
  const [saved, setSaved] = useState({});
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch(`${API}/settings`).then(r => r.json()).then(data => {
      const configured = {};
      PROVIDERS.forEach(p => { configured[p.id] = !!data[p.id]; });
      setSaved(configured);
    });
  }, []);

  const save = async () => {
    const body = {};
    PROVIDERS.forEach(p => { if (keys[p.id] && keys[p.id] !== '••••••••••••••••') body[p.id] = keys[p.id]; });
    if (Object.keys(body).length === 0) { setStatus({ ok: false, msg: 'No new keys to save.' }); return; }
    const r = await fetch(`${API}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json();
    if (data.success) {
      const updated = { ...saved };
      data.updated.forEach(k => { updated[k] = true; });
      setSaved(updated);
      setKeys(prev => { const next = { ...prev }; data.updated.forEach(k => { next[k] = ''; }); return next; });
      setStatus({ ok: true, msg: `Saved ${data.updated.length} key(s) successfully.` });
    } else {
      setStatus({ ok: false, msg: 'Save failed.' });
    }
    setTimeout(() => setStatus(null), 3000);
  };

  const remove = async (key) => {
    await fetch(`${API}/settings/${key}`, { method: 'DELETE' });
    setSaved(prev => ({ ...prev, [key]: false }));
    setKeys(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <div>
      <div style={s.pageHeader}>
        <h1 style={s.pageTitle}>Settings</h1>
        <p style={s.pageSub}>Appearance and API key management</p>
      </div>

      {/* Theme Picker */}
      <div style={{ ...s.card, marginBottom: 20 }}>
        <h3 style={{ ...s.sectionTitle, marginBottom: 4 }}>Theme</h3>
        <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 16 }}>Choose your preferred color scheme.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {THEMES.map(t => (
            <div
              key={t.id}
              onClick={() => setTheme(t.id)}
              style={{
                padding: '14px 20px', borderRadius: 10, cursor: 'pointer', minWidth: 110, textAlign: 'center',
                border: `2px solid ${theme === t.id ? 'var(--gold)' : 'var(--border)'}`,
                background: theme === t.id ? 'rgba(201,151,58,0.08)' : 'var(--surface)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{t.label.split(' ')[0]}</div>
              <div style={{ fontSize: 13, fontWeight: theme === t.id ? 600 : 400, color: theme === t.id ? 'var(--gold)' : 'var(--ink)' }}>{t.label.split(' ').slice(1).join(' ')}</div>
              <div style={{ fontSize: 11, color: 'var(--warm-gray)', marginTop: 2 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* API Keys */}
      <div style={s.card}>
        <h3 style={{ ...s.sectionTitle, marginBottom: 4 }}>AI Provider API Keys</h3>
        <p style={{ fontSize: 13, color: 'var(--warm-gray)', marginBottom: 20 }}>
          Keys are stored securely in your local database and never leave your server.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {PROVIDERS.map(p => (
            <div key={p.id} style={{ padding: 16, borderRadius: 10, border: `1px solid ${saved[p.id] ? 'var(--sage)' : 'var(--border)'}`, background: saved[p.id] ? 'rgba(107,153,100,0.05)' : 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{p.label}</span>
                  {saved[p.id] && <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--sage)', fontWeight: 600 }}>✓ CONFIGURED</span>}
                </div>
                <a href={p.link} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none' }}>{p.linkLabel}</a>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="password"
                  style={{ ...s.input, flex: 1 }}
                  placeholder={saved[p.id] ? '•••••• (key saved — enter new to replace)' : p.placeholder}
                  value={keys[p.id]}
                  onChange={(e) => setKeys(prev => ({ ...prev, [p.id]: e.target.value }))}
                />
                {saved[p.id] && (
                  <button style={{ ...s.btn('outline'), borderColor: 'var(--terracotta)', color: 'var(--terracotta)', whiteSpace: 'nowrap' }} onClick={() => remove(p.id)}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button style={s.btn()} onClick={save}>Save Keys</button>
          {status && <span style={{ fontSize: 13, color: status.ok ? 'var(--sage)' : 'var(--terracotta)' }}>{status.msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState('dashboard');
  const [loans, setLoans] = useState([]);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [payments, setPayments] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('mortgageiq-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme === 'light' ? '' : theme);
    localStorage.setItem('mortgageiq-theme', theme);
  }, [theme]);

  const loadLoans = useCallback(async () => {
    const r = await fetch(`${API}/loans`);
    const data = await r.json();
    setLoans(data);
    return data;
  }, []);

  const selectLoan = useCallback(async (loan) => {
    setSelectedLoan(loan);
    const [a, p] = await Promise.all([
      fetch(`${API}/loans/${loan.id}/analytics`).then(r => r.json()),
      fetch(`${API}/loans/${loan.id}/payments`).then(r => r.json()),
    ]);
    setAnalytics(a);
    setPayments(p);
  }, []);

  const refreshData = useCallback(async () => {
    const data = await loadLoans();
    if (selectedLoan) {
      const updated = data.find(l => l.id === selectedLoan.id);
      if (updated) selectLoan(updated);
    }
  }, [selectedLoan, loadLoans, selectLoan]);

  useEffect(() => {
    loadLoans().then(data => {
      if (data.length > 0) selectLoan(data[0]);
    });
  }, []);

  const navItems = [
    { id: 'dashboard',  icon: '📊', label: 'Dashboard' },
    { id: 'payments',   icon: '💳', label: 'Payments' },
    { id: 'calculator', icon: '🧮', label: 'Payoff Calculator' },
    { id: 'escrow',     icon: '🏛️', label: 'Escrow Tracker' },
    { id: 'loans',      icon: '🏠', label: 'Manage Loans' },
    { id: 'settings',   icon: '⚙️', label: 'Settings' },
  ];

  const navigate = (id) => {
    setView(id);
    setSidebarOpen(false);
  };

  return (
    <div style={s.app} data-theme={theme === 'light' ? '' : theme}>
      {/* Mobile hamburger */}
      <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Sidebar */}
      <div className={`sidebar${sidebarOpen ? ' open' : ''}`} style={s.sidebar}>
        <div style={s.logo}>
          <div style={s.logoTitle}>MortgageIQ</div>
          <div style={s.logoSub}>Loan Manager</div>
        </div>
        <div style={s.navSection}>Navigation</div>
        {navItems.map(item => (
          <div key={item.id} style={s.navItem(view === item.id)} onClick={() => navigate(item.id)}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        <div style={s.loanPicker}>
          <div style={s.loanPickerLabel}>Active Loan</div>
          <select
            style={s.select}
            value={selectedLoan?.id || ''}
            onChange={(e) => {
              const l = loans.find(x => x.id === parseInt(e.target.value));
              if (l) selectLoan(l);
            }}
          >
            {loans.length === 0 && <option value="">No loans yet</option>}
            {loans.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content" style={s.main}>
        {view === 'dashboard'  && <Dashboard selectedLoan={selectedLoan} analytics={analytics} payments={payments} />}
        {view === 'payments'   && <PaymentsView loan={selectedLoan} payments={payments} onRefresh={refreshData} />}
        {view === 'calculator' && <Calculator loan={selectedLoan} />}
        {view === 'escrow'     && <EscrowView loan={selectedLoan} />}
        {view === 'loans'      && <LoansManager loans={loans} onRefresh={loadLoans} onSelect={(l) => { selectLoan(l); setView('dashboard'); }} />}
        {view === 'settings'   && <Settings theme={theme} setTheme={setTheme} />}
      </div>
    </div>
  );
}

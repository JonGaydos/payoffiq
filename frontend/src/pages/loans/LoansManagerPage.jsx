import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { LOAN_TYPES } from '../../utils/constants';
import { fmtDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoanForm from '../../components/loans/LoanForm';

export default function LoansManagerPage() {
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const navigate = useNavigate();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editLoan, setEditLoan] = useState(null);

  const loadLoans = async () => {
    const res = await authFetch(`${API_BASE}/loans`);
    if (res.ok) setLoans(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadLoans(); }, []);

  const handleSave = async (data) => {
    const url = editLoan
      ? `${API_BASE}/loans/${editLoan.id}`
      : `${API_BASE}/loans`;
    const res = await authFetch(url, {
      method: editLoan ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      setEditLoan(null);
      loadLoans();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this loan and all its payment history?')) return;
    const res = await authFetch(`${API_BASE}/loans/${id}`, { method: 'DELETE' });
    if (res.ok) loadLoans();
  };

  const getLoanType = (type) => LOAN_TYPES.find(t => t.value === type) || LOAN_TYPES[0];

  // Group loans by type
  const grouped = loans.reduce((acc, loan) => {
    const type = loan.loan_type || 'mortgage';
    if (!acc[type]) acc[type] = [];
    acc[type].push(loan);
    return acc;
  }, {});

  if (loading) {
    return <div className="text-warm-gray text-center py-12">Loading loans...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Loans</h1>
        <Button onClick={() => { setEditLoan(null); setShowForm(true); }}>
          + Add Loan
        </Button>
      </div>

      {showForm && (
        <Card>
          <h2 className="font-serif text-lg font-bold mb-4">
            {editLoan ? 'Edit Loan' : 'New Loan'}
          </h2>
          <LoanForm
            loan={editLoan}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditLoan(null); }}
          />
        </Card>
      )}

      {loans.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-warm-gray mb-4">No loans added yet.</p>
            <Button onClick={() => setShowForm(true)}>Add Your First Loan</Button>
          </div>
        </Card>
      ) : (
        Object.entries(grouped).map(([type, typeLoans]) => {
          const loanType = getLoanType(type);
          return (
            <div key={type}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-warm-gray mb-2">
                {loanType.icon} {loanType.label}s
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {typeLoans.map(loan => (
                  <Card key={loan.id} className="cursor-pointer hover:ring-1 hover:ring-gold/30 transition-all">
                    <div onClick={() => navigate(`/loans/${loan.id}`)}>
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-serif font-bold text-lg">{loan.name}</h3>
                        <Badge color={loan.loan_type === 'arm' ? 'orange' : 'blue'}>
                          {loanType.label}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-warm-gray">Balance</span>
                          <span className="font-semibold">{fmt(loan.current_balance ?? loan.original_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-warm-gray">Original</span>
                          <span>{fmt(loan.original_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-warm-gray">Rate</span>
                          <span>{loan.interest_rate}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-warm-gray">Payment</span>
                          <span>{fmt(loan.monthly_payment)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-warm-gray">Start Date</span>
                          <span>{fmtDate(loan.start_date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3 pt-3 border-t border-card-border">
                      <Button
                        variant="ghost"
                        className="text-xs flex-1"
                        onClick={(e) => { e.stopPropagation(); setEditLoan(loan); setShowForm(true); }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-xs flex-1 text-danger"
                        onClick={(e) => { e.stopPropagation(); handleDelete(loan.id); }}
                      >
                        Delete
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

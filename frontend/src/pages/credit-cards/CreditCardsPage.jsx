import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import CreditCardForm from '../../components/credit-cards/CreditCardForm';

function utilizationColor(pct) {
  if (pct <= 30) return 'green';
  if (pct <= 50) return 'orange';
  return 'red';
}

export default function CreditCardsPage() {
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCard, setEditCard] = useState(null);

  const loadData = async () => {
    const [cardsRes, dashRes] = await Promise.all([
      authFetch(`${API_BASE}/credit-cards`),
      authFetch(`${API_BASE}/credit-cards/dashboard/summary`),
    ]);
    if (cardsRes.ok) setCards(await cardsRes.json());
    if (dashRes.ok) setDashboard(await dashRes.json());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (data) => {
    const url = editCard
      ? `${API_BASE}/credit-cards/${editCard.id}`
      : `${API_BASE}/credit-cards`;
    const res = await authFetch(url, {
      method: editCard ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      setEditCard(null);
      loadData();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this card and all its snapshots?')) return;
    await authFetch(`${API_BASE}/credit-cards/${id}`, { method: 'DELETE' });
    loadData();
  };

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Credit Cards</h1>
        <Button onClick={() => { setEditCard(null); setShowForm(true); }}>
          + Add Card
        </Button>
      </div>

      {/* Dashboard Totals */}
      {dashboard && dashboard.totals.card_count > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total CC Debt"
            value={fmt(dashboard.totals.total_debt)}
            color="var(--color-terracotta)"
          />
          <StatCard
            label="Total Credit Limit"
            value={fmt(dashboard.totals.total_limit)}
          />
          <StatCard
            label="Overall Utilization"
            value={`${dashboard.totals.overall_utilization}%`}
            color={dashboard.totals.overall_utilization > 30 ? 'var(--color-terracotta)' : 'var(--color-sage)'}
          />
          <StatCard
            label="Cards"
            value={dashboard.totals.card_count}
          />
        </div>
      )}

      {/* Card Form */}
      {showForm && (
        <Card>
          <h2 className="font-serif text-lg font-bold mb-4">
            {editCard ? 'Edit Card' : 'New Credit Card'}
          </h2>
          <CreditCardForm
            card={editCard}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditCard(null); }}
          />
        </Card>
      )}

      {/* Card List */}
      {cards.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-warm-gray mb-4">No credit cards added yet.</p>
            <Button onClick={() => setShowForm(true)}>Add Your First Card</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(card => {
            const balance = card.latest_snapshot?.current_balance || 0;
            return (
              <Card
                key={card.id}
                className="cursor-pointer hover:ring-1 hover:ring-gold/30 transition-all"
              >
                <div onClick={() => navigate(`/credit-cards/${card.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-serif font-bold text-lg">{card.name}</h3>
                      {card.issuer && (
                        <p className="text-xs text-warm-gray">{card.issuer}{card.last_four ? ` ****${card.last_four}` : ''}</p>
                      )}
                    </div>
                    <Badge color={utilizationColor(card.utilization)}>
                      {card.utilization}%
                    </Badge>
                  </div>

                  {/* Utilization Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-warm-gray mb-1">
                      <span>{fmt(balance)}</span>
                      <span>{fmt(card.credit_limit)}</span>
                    </div>
                    <div className="h-2 bg-card-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(card.utilization, 100)}%`,
                          background: card.utilization > 50 ? 'var(--color-terracotta)' : card.utilization > 30 ? 'var(--color-gold)' : 'var(--color-sage)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-warm-gray">APR</span>
                      <span className="font-semibold">{card.apr}%</span>
                    </div>
                    {card.annual_fee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-warm-gray">Annual Fee</span>
                        <span>{fmt(card.annual_fee)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-card-border">
                  <Button
                    variant="ghost"
                    className="text-xs flex-1"
                    onClick={(e) => { e.stopPropagation(); setEditCard(card); setShowForm(true); }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs flex-1 text-danger"
                    onClick={(e) => { e.stopPropagation(); handleDelete(card.id); }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Strategy Rankings */}
      {dashboard && dashboard.cards.length > 1 && dashboard.totals.total_debt > 0 && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card accent="var(--color-terracotta)">
            <h3 className="font-serif font-bold mb-3">Avalanche Order (Highest APR First)</h3>
            <p className="text-xs text-warm-gray mb-3">Mathematically optimal — saves the most interest</p>
            <div className="space-y-2">
              {dashboard.avalanche_order.map((id, i) => {
                const card = dashboard.cards.find(c => c.id === id);
                if (!card || card.current_balance <= 0) return null;
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-terracotta/20 text-terracotta text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">{card.name}</span>
                    <span className="text-warm-gray">{card.apr}%</span>
                    <span className="font-semibold">{fmt(card.current_balance)}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card accent="var(--color-sage)">
            <h3 className="font-serif font-bold mb-3">Snowball Order (Lowest Balance First)</h3>
            <p className="text-xs text-warm-gray mb-3">Quick wins for motivation — pays off small debts first</p>
            <div className="space-y-2">
              {dashboard.snowball_order.map((id, i) => {
                const card = dashboard.cards.find(c => c.id === id);
                if (!card) return null;
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full bg-sage/20 text-sage text-xs flex items-center justify-center font-bold">{i + 1}</span>
                    <span className="flex-1 truncate">{card.name}</span>
                    <span className="font-semibold">{fmt(card.current_balance)}</span>
                    <span className="text-warm-gray">{card.apr}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

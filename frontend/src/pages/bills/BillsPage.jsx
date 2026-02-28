import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import StatCard from '../../components/ui/StatCard';
import CategoryForm from '../../components/bills/CategoryForm';

export default function BillsPage() {
  const { authFetch } = useAuth();
  const { fmt } = useCurrency();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState(null);

  const loadData = async () => {
    const [catRes, dashRes] = await Promise.all([
      authFetch(`${API_BASE}/bill-categories`),
      authFetch(`${API_BASE}/bills/dashboard/summary`),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (dashRes.ok) setDashboard(await dashRes.json());
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (data) => {
    const url = editCategory
      ? `${API_BASE}/bill-categories/${editCategory.id}`
      : `${API_BASE}/bill-categories`;
    const res = await authFetch(url, {
      method: editCategory ? 'PUT' : 'POST',
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowForm(false);
      setEditCategory(null);
      loadData();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this category and all its bills?')) return;
    await authFetch(`${API_BASE}/bill-categories/${id}`, { method: 'DELETE' });
    loadData();
  };

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold">Utilities & Bills</h1>
        <Button onClick={() => { setEditCategory(null); setShowForm(true); }}>
          + Add Category
        </Button>
      </div>

      {/* Dashboard Summary */}
      {dashboard && dashboard.totals.category_count > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Monthly Estimate"
            value={fmt(dashboard.totals.monthly_estimate)}
            color="var(--color-gold)"
            subtitle="Forecasted from history"
          />
          <StatCard
            label="This Month"
            value={fmt(dashboard.totals.this_month)}
          />
          <StatCard
            label="Unpaid Bills"
            value={fmt(dashboard.totals.unpaid_total)}
            color={dashboard.totals.unpaid_total > 0 ? 'var(--color-terracotta)' : undefined}
          />
          <StatCard
            label="Categories"
            value={dashboard.totals.category_count}
          />
        </div>
      )}

      {/* Category Form */}
      {showForm && (
        <Card>
          <h2 className="font-serif text-lg font-bold mb-4">
            {editCategory ? 'Edit Category' : 'New Bill Category'}
          </h2>
          <CategoryForm
            category={editCategory}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditCategory(null); }}
          />
        </Card>
      )}

      {/* Category List */}
      {categories.length === 0 && !showForm ? (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{'\u{1F4A1}'}</div>
            <p className="text-warm-gray mb-4">No bill categories yet. Create categories like Electric, Water, Internet, etc.</p>
            <Button onClick={() => setShowForm(true)}>Create Your First Category</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map(cat => {
            const dashCat = dashboard?.categories?.find(c => c.id === cat.id);
            return (
              <Card
                key={cat.id}
                className="cursor-pointer hover:ring-1 hover:ring-gold/30 transition-all"
              >
                <div onClick={() => navigate(`/bills/${cat.id}`)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{cat.icon}</span>
                      <div>
                        <h3 className="font-serif font-bold text-lg">{cat.name}</h3>
                        <p className="text-xs text-warm-gray capitalize">{cat.cycle}</p>
                      </div>
                    </div>
                    {cat.unpaid_count > 0 && (
                      <Badge color="orange">{cat.unpaid_count} unpaid</Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-warm-gray">Latest</span>
                      <span className="font-semibold">{cat.latest_amount != null ? fmt(cat.latest_amount) : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-warm-gray">Average</span>
                      <span>{fmt(cat.avg_amount)}</span>
                    </div>
                    {dashCat && dashCat.forecast > 0 && (
                      <div className="flex justify-between">
                        <span className="text-warm-gray">Forecast</span>
                        <span className="flex items-center gap-1">
                          {fmt(dashCat.forecast)}
                          {dashCat.trend !== 0 && (
                            <span className={`text-xs ${dashCat.trend > 0 ? 'text-terracotta' : 'text-sage'}`}>
                              {dashCat.trend > 0 ? '\u2191' : '\u2193'}{Math.abs(dashCat.trend)}%
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {cat.usage_unit && (
                      <div className="flex justify-between">
                        <span className="text-warm-gray">Tracks</span>
                        <span className="text-xs">{cat.usage_unit}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-warm-gray mt-2">{cat.bill_count} bills recorded</p>
                </div>

                <div className="flex gap-2 mt-3 pt-3 border-t border-card-border">
                  <Button
                    variant="ghost"
                    className="text-xs flex-1"
                    onClick={(e) => { e.stopPropagation(); setEditCategory(cat); setShowForm(true); }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-xs flex-1 text-danger"
                    onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

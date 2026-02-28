import { Router } from 'express';
import db from '../db/index.js';
import { auth } from '../middleware/auth.js';

const router = Router();
router.use(auth);

// ─── Credit Cards CRUD ───

// List all cards
router.get('/', (req, res) => {
  const cards = db.prepare('SELECT * FROM credit_cards ORDER BY name').all();

  // Attach latest snapshot to each card
  const enriched = cards.map(card => {
    const latest = db.prepare(
      'SELECT * FROM credit_card_snapshots WHERE card_id = ? ORDER BY snapshot_date DESC, id DESC LIMIT 1'
    ).get(card.id);

    const utilization = latest && card.credit_limit > 0
      ? Math.round((latest.current_balance / card.credit_limit) * 10000) / 100
      : 0;

    return {
      ...card,
      latest_snapshot: latest || null,
      utilization,
    };
  });

  res.json(enriched);
});

// Get single card with all snapshots
router.get('/:id', (req, res) => {
  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const snapshots = db.prepare(
    'SELECT * FROM credit_card_snapshots WHERE card_id = ? ORDER BY snapshot_date ASC, id ASC'
  ).all(req.params.id);

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const utilization = latest && card.credit_limit > 0
    ? Math.round((latest.current_balance / card.credit_limit) * 10000) / 100
    : 0;

  res.json({ ...card, snapshots, utilization });
});

// Create card
router.post('/', (req, res) => {
  const { name, issuer, last_four, credit_limit, apr, min_payment_pct,
    min_payment_fixed, annual_fee, reward_type, notes } = req.body;

  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO credit_cards (name, issuer, last_four, credit_limit, apr,
      min_payment_pct, min_payment_fixed, annual_fee, reward_type, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name, issuer || null, last_four || null, credit_limit || 0, apr || 0,
    min_payment_pct ?? 1, min_payment_fixed ?? 25, annual_fee || 0,
    reward_type || null, notes || null
  );

  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(card);
});

// Update card
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Card not found' });

  const { name, issuer, last_four, credit_limit, apr, min_payment_pct,
    min_payment_fixed, annual_fee, reward_type, notes } = req.body;

  db.prepare(`
    UPDATE credit_cards SET name=?, issuer=?, last_four=?, credit_limit=?, apr=?,
      min_payment_pct=?, min_payment_fixed=?, annual_fee=?, reward_type=?, notes=?
    WHERE id=?
  `).run(
    name ?? existing.name, issuer ?? existing.issuer,
    last_four ?? existing.last_four, credit_limit ?? existing.credit_limit,
    apr ?? existing.apr, min_payment_pct ?? existing.min_payment_pct,
    min_payment_fixed ?? existing.min_payment_fixed, annual_fee ?? existing.annual_fee,
    reward_type ?? existing.reward_type, notes ?? existing.notes,
    req.params.id
  );

  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(req.params.id);
  res.json(card);
});

// Delete card
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Card not found' });
  db.prepare('DELETE FROM credit_cards WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Snapshots ───

// List snapshots for a card
router.get('/:id/snapshots', (req, res) => {
  const snapshots = db.prepare(
    'SELECT * FROM credit_card_snapshots WHERE card_id = ? ORDER BY snapshot_date DESC, id DESC'
  ).all(req.params.id);
  res.json(snapshots);
});

// Add snapshot
router.post('/:id/snapshots', (req, res) => {
  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const { snapshot_date, statement_balance, current_balance, minimum_payment,
    payment_made, apr, credit_limit, notes } = req.body;

  if (!snapshot_date) return res.status(400).json({ error: 'Snapshot date is required' });

  const result = db.prepare(`
    INSERT INTO credit_card_snapshots (card_id, snapshot_date, statement_balance,
      current_balance, minimum_payment, payment_made, apr, credit_limit, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, snapshot_date,
    statement_balance || 0, current_balance || 0,
    minimum_payment || 0, payment_made || 0,
    apr ?? card.apr, credit_limit ?? card.credit_limit,
    notes || null
  );

  const snapshot = db.prepare('SELECT * FROM credit_card_snapshots WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(snapshot);
});

// Update snapshot
router.put('/snapshots/:snapshotId', (req, res) => {
  const existing = db.prepare('SELECT * FROM credit_card_snapshots WHERE id = ?').get(req.params.snapshotId);
  if (!existing) return res.status(404).json({ error: 'Snapshot not found' });

  const { snapshot_date, statement_balance, current_balance, minimum_payment,
    payment_made, apr, credit_limit, notes } = req.body;

  db.prepare(`
    UPDATE credit_card_snapshots SET snapshot_date=?, statement_balance=?,
      current_balance=?, minimum_payment=?, payment_made=?, apr=?, credit_limit=?, notes=?
    WHERE id=?
  `).run(
    snapshot_date ?? existing.snapshot_date,
    statement_balance ?? existing.statement_balance,
    current_balance ?? existing.current_balance,
    minimum_payment ?? existing.minimum_payment,
    payment_made ?? existing.payment_made,
    apr ?? existing.apr, credit_limit ?? existing.credit_limit,
    notes ?? existing.notes,
    req.params.snapshotId
  );

  const snapshot = db.prepare('SELECT * FROM credit_card_snapshots WHERE id = ?').get(req.params.snapshotId);
  res.json(snapshot);
});

// Delete snapshot
router.delete('/snapshots/:snapshotId', (req, res) => {
  const existing = db.prepare('SELECT * FROM credit_card_snapshots WHERE id = ?').get(req.params.snapshotId);
  if (!existing) return res.status(404).json({ error: 'Snapshot not found' });
  db.prepare('DELETE FROM credit_card_snapshots WHERE id = ?').run(req.params.snapshotId);
  res.json({ success: true });
});

// ─── Analytics ───

// Card analytics summary
router.get('/:id/analytics', (req, res) => {
  const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(req.params.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const snapshots = db.prepare(
    'SELECT * FROM credit_card_snapshots WHERE card_id = ? ORDER BY snapshot_date ASC'
  ).all(req.params.id);

  if (snapshots.length === 0) {
    return res.json({ card, snapshots: [], analytics: null });
  }

  const latest = snapshots[snapshots.length - 1];
  const totalPayments = snapshots.reduce((s, snap) => s + (parseFloat(snap.payment_made) || 0), 0);

  // Balance velocity: change per month
  const velocityData = snapshots.map((snap, i) => {
    const prev = i > 0 ? snapshots[i - 1] : null;
    return {
      date: snap.snapshot_date,
      balance: snap.current_balance,
      statement_balance: snap.statement_balance,
      payment: snap.payment_made || 0,
      change: prev ? snap.current_balance - prev.current_balance : 0,
    };
  });

  // Utilization over time
  const utilizationData = snapshots.map(snap => ({
    date: snap.snapshot_date,
    utilization: (snap.credit_limit || card.credit_limit) > 0
      ? Math.round((snap.current_balance / (snap.credit_limit || card.credit_limit)) * 10000) / 100
      : 0,
  }));

  // Payoff estimate at current rate
  let payoffMonths = null;
  if (snapshots.length >= 2) {
    const avgPayment = totalPayments / snapshots.length;
    const monthlyInterest = latest.current_balance * ((latest.apr || card.apr) / 100 / 12);
    const netPayment = avgPayment - monthlyInterest;
    if (netPayment > 0) {
      payoffMonths = Math.ceil(latest.current_balance / netPayment);
    }
  }

  res.json({
    card,
    snapshots,
    analytics: {
      current_balance: parseFloat(latest.current_balance) || 0,
      credit_limit: parseFloat(latest.credit_limit || card.credit_limit) || 0,
      utilization: (latest.credit_limit || card.credit_limit) > 0
        ? Math.round((latest.current_balance / (latest.credit_limit || card.credit_limit)) * 10000) / 100
        : 0,
      total_payments: Math.round(totalPayments * 100) / 100,
      avg_payment: Math.round((totalPayments / snapshots.length) * 100) / 100,
      snapshot_count: snapshots.length,
      payoff_months: payoffMonths,
      velocity_data: velocityData,
      utilization_data: utilizationData,
    },
  });
});

// Dashboard summary (all cards)
router.get('/dashboard/summary', (req, res) => {
  const cards = db.prepare('SELECT * FROM credit_cards ORDER BY name').all();

  const summaries = cards.map(card => {
    const latest = db.prepare(
      'SELECT * FROM credit_card_snapshots WHERE card_id = ? ORDER BY snapshot_date DESC, id DESC LIMIT 1'
    ).get(card.id);

    const currentBalance = latest ? parseFloat(latest.current_balance) || 0 : 0;
    const utilization = card.credit_limit > 0
      ? Math.round((currentBalance / card.credit_limit) * 10000) / 100
      : 0;

    return {
      id: card.id,
      name: card.name,
      issuer: card.issuer,
      last_four: card.last_four,
      apr: card.apr,
      credit_limit: card.credit_limit,
      current_balance: currentBalance,
      utilization,
      last_snapshot_date: latest?.snapshot_date || null,
    };
  });

  // Sort by APR descending for avalanche ranking
  const avalancheOrder = [...summaries].sort((a, b) => b.apr - a.apr);
  // Sort by balance ascending for snowball ranking
  const snowballOrder = [...summaries].sort((a, b) => a.current_balance - b.current_balance);

  const totalDebt = summaries.reduce((s, c) => s + c.current_balance, 0);
  const totalLimit = summaries.reduce((s, c) => s + c.credit_limit, 0);
  const overallUtilization = totalLimit > 0
    ? Math.round((totalDebt / totalLimit) * 10000) / 100
    : 0;

  res.json({
    cards: summaries,
    avalanche_order: avalancheOrder.map(c => c.id),
    snowball_order: snowballOrder.filter(c => c.current_balance > 0).map(c => c.id),
    totals: {
      total_debt: Math.round(totalDebt * 100) / 100,
      total_limit: Math.round(totalLimit * 100) / 100,
      overall_utilization: overallUtilization,
      card_count: cards.length,
    },
  });
});

export default router;

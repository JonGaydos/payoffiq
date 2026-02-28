export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      issuer TEXT,
      last_four TEXT,
      credit_limit REAL NOT NULL DEFAULT 0,
      apr REAL NOT NULL DEFAULT 0,
      min_payment_pct REAL DEFAULT 1,
      min_payment_fixed REAL DEFAULT 25,
      annual_fee REAL DEFAULT 0,
      reward_type TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_card_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      snapshot_date TEXT NOT NULL,
      statement_balance REAL NOT NULL DEFAULT 0,
      current_balance REAL NOT NULL DEFAULT 0,
      minimum_payment REAL DEFAULT 0,
      payment_made REAL DEFAULT 0,
      apr REAL,
      credit_limit REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES credit_cards(id) ON DELETE CASCADE
    )
  `);
}

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      loan_type TEXT NOT NULL DEFAULT 'mortgage',
      original_amount REAL NOT NULL,
      interest_rate REAL NOT NULL,
      loan_term_months INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      monthly_payment REAL NOT NULL,
      current_balance REAL,
      estimated_value REAL,
      currency TEXT DEFAULT 'USD',
      arm_fixed_months INTEGER,
      arm_rate_cap REAL,
      arm_rate_floor REAL,
      arm_periodic_cap REAL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS arm_rate_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      rate REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      total_payment REAL NOT NULL DEFAULT 0,
      principal REAL NOT NULL DEFAULT 0,
      interest REAL NOT NULL DEFAULT 0,
      escrow REAL DEFAULT 0,
      extra_principal REAL DEFAULT 0,
      ending_balance REAL,
      statement_month TEXT,
      statement_filename TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS escrow_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      year INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS escrow_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL UNIQUE,
      starting_balance REAL DEFAULT 0,
      target_balance REAL DEFAULT 0,
      monthly_escrow REAL DEFAULT 0,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS escrow_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loan_id INTEGER NOT NULL,
      effective_date TEXT NOT NULL,
      new_monthly_escrow REAL,
      new_target_balance REAL,
      reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
    )
  `);
}

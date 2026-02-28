export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bill_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '💡',
      color TEXT DEFAULT 'var(--color-gold)',
      usage_unit TEXT,
      usage_label TEXT,
      cycle TEXT DEFAULT 'monthly',
      custom_fields TEXT DEFAULT '[]',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      bill_date TEXT NOT NULL,
      due_date TEXT,
      amount REAL NOT NULL DEFAULT 0,
      usage_amount REAL,
      paid INTEGER DEFAULT 0,
      paid_date TEXT,
      custom_data TEXT DEFAULT '{}',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category_id) REFERENCES bill_categories(id) ON DELETE CASCADE
    )
  `);
}

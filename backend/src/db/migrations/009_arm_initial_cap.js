export function up(db) {
  // Add arm_initial_cap column to loans table
  const cols = db.prepare("PRAGMA table_info(loans)").all();
  if (!cols.find(c => c.name === 'arm_initial_cap')) {
    db.exec('ALTER TABLE loans ADD COLUMN arm_initial_cap REAL');
  }
}

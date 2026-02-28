import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || '/data';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const STATEMENTS_DIR = path.join(DATA_DIR, 'statements');
const DB_PATH = path.join(DATA_DIR, 'payoffiq.db');
const JWT_SECRET = process.env.JWT_SECRET || 'payoffiq-jwt-secret-change-me';

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(STATEMENTS_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    reset_token TEXT,
    reset_token_expires TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
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
    arm_fixed_months INTEGER,
    arm_rate_cap REAL,
    arm_rate_floor REAL,
    arm_periodic_cap REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS arm_rate_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    effective_date TEXT NOT NULL,
    rate REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    payment_date TEXT NOT NULL,
    total_payment REAL NOT NULL,
    principal REAL NOT NULL DEFAULT 0,
    interest REAL NOT NULL DEFAULT 0,
    escrow REAL NOT NULL DEFAULT 0,
    extra_principal REAL NOT NULL DEFAULT 0,
    ending_balance REAL,
    statement_month TEXT,
    notes TEXT,
    statement_filename TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS escrow_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    payment_date TEXT,
    year INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS escrow_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER UNIQUE REFERENCES loans(id) ON DELETE CASCADE,
    starting_balance REAL NOT NULL DEFAULT 0,
    target_balance REAL,
    notes TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS escrow_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    effective_date TEXT NOT NULL,
    new_monthly_escrow REAL NOT NULL,
    new_target_balance REAL,
    reason TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bill_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '💡',
    color TEXT DEFAULT '#7B8FA1',
    custom_fields TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER REFERENCES bill_categories(id) ON DELETE CASCADE,
    bill_date TEXT NOT NULL,
    amount REAL NOT NULL,
    due_date TEXT,
    paid INTEGER DEFAULT 0,
    notes TEXT,
    custom_data TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS loan_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
    escrow_item_id INTEGER,
    bill_id INTEGER,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    doc_type TEXT DEFAULT 'document',
    description TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

// Safe migrations
[
  `ALTER TABLE loans ADD COLUMN loan_type TEXT NOT NULL DEFAULT 'mortgage'`,
  `ALTER TABLE loans ADD COLUMN arm_fixed_months INTEGER`,
  `ALTER TABLE loans ADD COLUMN arm_rate_cap REAL`,
  `ALTER TABLE loans ADD COLUMN arm_rate_floor REAL`,
  `ALTER TABLE loans ADD COLUMN arm_periodic_cap REAL`,
  `ALTER TABLE payments ADD COLUMN statement_filename TEXT`,
  `ALTER TABLE users ADD COLUMN reset_token TEXT`,
  `ALTER TABLE users ADD COLUMN reset_token_expires TEXT`,
  `ALTER TABLE loan_documents ADD COLUMN escrow_item_id INTEGER`,
  `ALTER TABLE loan_documents ADD COLUMN bill_id INTEGER`,
  `ALTER TABLE settings ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`,
  `ALTER TABLE bill_categories ADD COLUMN cycle TEXT DEFAULT 'monthly'`,
  `ALTER TABLE loan_documents ADD COLUMN paperless_url TEXT`,
].forEach(sql => { try { db.prepare(sql).run(); } catch (e) {} });

console.log('Database initialized at ' + DB_PATH);

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}
function setSetting(key, value) {
  db.prepare(`INSERT INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at`).run(key, value);
}
function updateLoanBalance(loanId) {
  const latest = db.prepare('SELECT ending_balance FROM payments WHERE loan_id=? ORDER BY payment_date DESC,created_at DESC LIMIT 1').get(loanId);
  if (latest && latest.ending_balance != null)
    db.prepare('UPDATE loans SET current_balance=? WHERE id=?').run(latest.ending_balance, loanId);
}

// ─── AI EXTRACTION ────────────────────────────────────────────────────────────
const PDF_PROMPT = `Extract mortgage payment information from this statement. Return ONLY a raw JSON object with no markdown, no code blocks, no backticks, no explanation.
{"payment_date":"YYYY-MM-DD","statement_month":"YYYY-MM","total_payment":0.00,"principal":0.00,"interest":0.00,"escrow":0.00,"extra_principal":0.00,"ending_balance":0.00,"notes":""}
Use null for missing values.`;

const ESCROW_PDF_PROMPT = `Extract escrow account information from this annual escrow statement. Return ONLY a raw JSON object with no markdown, no code blocks, no backticks, no explanation.
{"period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD","starting_balance":0.00,"ending_balance":0.00,"total_deposits":0.00,"total_disbursements":0.00,"new_monthly_escrow":0.00,"target_balance":0.00,"shortage_surplus":0.00,"disbursements":[{"date":"YYYY-MM-DD","description":"","amount":0.00}],"notes":""}
Use null for missing values.`;

const BILL_PDF_PROMPT = `Extract utility/service bill information from this statement. Return ONLY a raw JSON object with no markdown, no code blocks, no backticks, no explanation.
{"bill_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD","amount":0.00,"usage_kwh":null,"usage_gallons":null,"usage_gb":null,"service_period_start":null,"service_period_end":null,"account_number":null,"notes":""}
Use null for missing values.`;

function parseAI(text) { return JSON.parse(text.trim().replace(/```json|```/g,'').trim()); }

async function extractFromPDF(provider, apiKey, b64, prompt) {
  if (provider === 'claude') {
    const c = new Anthropic({ apiKey });
    const r = await c.messages.create({ model:'claude-opus-4-6', max_tokens:2048,
      messages:[{role:'user',content:[{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},{type:'text',text:prompt}]}]});
    return parseAI(r.content[0].text);
  }
  if (provider === 'openai' || provider === 'copilot') {
    const c = provider === 'copilot' ? new OpenAI({apiKey,baseURL:'https://models.inference.ai.azure.com'}) : new OpenAI({ apiKey });
    const r = await c.chat.completions.create({ model:'gpt-4o', max_tokens:2048,
      messages:[{role:'user',content:[{type:'file',file:{filename:'statement.pdf',file_data:'data:application/pdf;base64,'+b64}},{type:'text',text:prompt}]}]});
    return parseAI(r.choices[0].message.content);
  }
  if (provider === 'gemini') {
    const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({model:'gemini-2.0-flash'});
    const r = await m.generateContent([{inlineData:{mimeType:'application/pdf',data:b64}},prompt]);
    return parseAI(r.response.text());
  }
  throw new Error('Unknown provider');
}

// ─── EXPRESS ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use('/statements', express.static(STATEMENTS_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => cb(null, Date.now()+'-'+file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_'))
  }),
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.originalname);
    cb(null, ok);
  },
  limits: { fileSize: 50*1024*1024 }
});

function auth(req, res, next) {
  const h = req.headers['authorization'];
  if (!h) return res.status(401).json({ error:'No token' });
  try { req.user = jwt.verify(h.replace('Bearer ',''), JWT_SECRET); next(); }
  catch(e) { res.status(401).json({ error:'Invalid token' }); }
}

// ─── PUBLIC AUTH ──────────────────────────────────────────────────────────────
app.get('/api/auth/status', (req, res) => {
  res.json({ needsSetup: db.prepare('SELECT COUNT(*) as c FROM users').get().c === 0 });
});
app.post('/api/auth/setup', (req, res) => {
  if (db.prepare('SELECT COUNT(*) as c FROM users').get().c > 0)
    return res.status(400).json({ error:'Setup already complete' });
  const { username, password } = req.body;
  if (!username || !password || password.length < 6)
    return res.status(400).json({ error:'Username and password (min 6 chars) required' });
  db.prepare('INSERT INTO users (username,password_hash) VALUES (?,?)').run(username, bcrypt.hashSync(password,10));
  res.json({ token: jwt.sign({username},JWT_SECRET,{expiresIn:'30d'}), username });
});
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error:'Invalid credentials' });
  res.json({ token: jwt.sign({username},JWT_SECRET,{expiresIn:'30d'}), username });
});
app.get('/api/auth/generate-reset-token', (req, res) => {
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) return res.status(404).json({ error: 'No user account found' });
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token=?, reset_token_expires=? WHERE id=?').run(token, expires, user.id);
  res.json({ message:'Reset token generated. Open the URL below in your browser within 15 minutes.', reset_url:`/reset-password?token=${token}` });
});
app.get('/api/auth/validate-reset-token', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error:'Token required' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
  if (!user) return res.status(400).json({ error:'Invalid or expired token' });
  if (new Date(user.reset_token_expires) < new Date()) return res.status(400).json({ error:'Token expired' });
  res.json({ valid:true, username:user.username });
});
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6) return res.status(400).json({ error:'Token and password (min 6) required' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
  if (!user) return res.status(400).json({ error:'Invalid or expired token' });
  if (new Date(user.reset_token_expires) < new Date()) return res.status(400).json({ error:'Token expired' });
  db.prepare('UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL WHERE id=?').run(bcrypt.hashSync(newPassword,10), user.id);
  res.json({ success:true, message:'Password updated' });
});

// ─── PROTECTED ────────────────────────────────────────────────────────────────
app.use('/api', auth);

app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(req.user.username);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(401).json({ error:'Current password incorrect' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error:'Min 6 characters' });
  db.prepare('UPDATE users SET password_hash=? WHERE username=?').run(bcrypt.hashSync(newPassword,10), req.user.username);
  res.json({ success:true });
});

// SETTINGS
app.get('/api/settings', (req,res) => {
  const rows = db.prepare('SELECT key,value FROM settings').all();
  const s = {}; rows.forEach(r=>{s[r.key]=r.value;});
  ['claude_api_key','openai_api_key','gemini_api_key','copilot_api_key'].forEach(k=>{if(s[k])s[k]='••••••••••••••••';});
  res.json(s);
});
app.post('/api/settings', (req,res) => {
  const allowed=['claude_api_key','openai_api_key','gemini_api_key','copilot_api_key','paperless_ngx_url'];
  const updates=[];
  for(const [k,v] of Object.entries(req.body)){
    if(!allowed.includes(k))continue;
    if(k==='paperless_ngx_url'){setSetting(k,v||'');updates.push(k);} // allow empty string to clear
    else if(v&&v!=='••••••••••••••••'){setSetting(k,v);updates.push(k);}
  }
  res.json({success:true,updated:updates});
});
app.delete('/api/settings/:key', (req,res) => {
  const allowed=['claude_api_key','openai_api_key','gemini_api_key','copilot_api_key'];
  if(!allowed.includes(req.params.key))return res.status(400).json({error:'Invalid key'});
  db.prepare('DELETE FROM settings WHERE key=?').run(req.params.key);
  res.json({success:true});
});

// LOANS
app.get('/api/loans', (req,res) => res.json(db.prepare('SELECT * FROM loans ORDER BY created_at DESC').all()));
app.post('/api/loans', (req,res) => {
  const {name,loan_type,original_amount,interest_rate,loan_term_months,start_date,monthly_payment,arm_fixed_months,arm_rate_cap,arm_rate_floor,arm_periodic_cap}=req.body;
  const r=db.prepare(`INSERT INTO loans (name,loan_type,original_amount,interest_rate,loan_term_months,start_date,monthly_payment,current_balance,arm_fixed_months,arm_rate_cap,arm_rate_floor,arm_periodic_cap) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(name,loan_type||'mortgage',original_amount,interest_rate,loan_term_months,start_date,monthly_payment,original_amount,arm_fixed_months||null,arm_rate_cap||null,arm_rate_floor||null,arm_periodic_cap||null);
  res.json(db.prepare('SELECT * FROM loans WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/loans/:id', (req,res) => {
  const {name,loan_type,original_amount,interest_rate,loan_term_months,start_date,monthly_payment,arm_fixed_months,arm_rate_cap,arm_rate_floor,arm_periodic_cap}=req.body;
  db.prepare(`UPDATE loans SET name=?,loan_type=?,original_amount=?,interest_rate=?,loan_term_months=?,start_date=?,monthly_payment=?,arm_fixed_months=?,arm_rate_cap=?,arm_rate_floor=?,arm_periodic_cap=? WHERE id=?`)
    .run(name,loan_type||'mortgage',original_amount,interest_rate,loan_term_months,start_date,monthly_payment,arm_fixed_months||null,arm_rate_cap||null,arm_rate_floor||null,arm_periodic_cap||null,req.params.id);
  res.json(db.prepare('SELECT * FROM loans WHERE id=?').get(req.params.id));
});
app.delete('/api/loans/:id', (req,res) => {
  const docs=db.prepare('SELECT filename FROM loan_documents WHERE loan_id=?').all(req.params.id);
  docs.forEach(d=>{try{fs.unlinkSync(path.join(STATEMENTS_DIR,d.filename));}catch(e){}});
  db.prepare('DELETE FROM loans WHERE id=?').run(req.params.id);
  res.json({success:true});
});

// ARM RATE HISTORY
app.get('/api/loans/:id/arm-rates', (req,res) =>
  res.json(db.prepare('SELECT * FROM arm_rate_history WHERE loan_id=? ORDER BY effective_date ASC').all(req.params.id)));
app.post('/api/loans/:id/arm-rates', (req,res) => {
  const {effective_date,rate,notes}=req.body;
  const r=db.prepare('INSERT INTO arm_rate_history (loan_id,effective_date,rate,notes) VALUES (?,?,?,?)').run(req.params.id,effective_date,rate,notes||null);
  db.prepare('UPDATE loans SET interest_rate=? WHERE id=?').run(rate,req.params.id);
  res.json(db.prepare('SELECT * FROM arm_rate_history WHERE id=?').get(r.lastInsertRowid));
});
app.delete('/api/arm-rates/:id', (req,res) => { db.prepare('DELETE FROM arm_rate_history WHERE id=?').run(req.params.id); res.json({success:true}); });

// PAYMENTS
app.get('/api/loans/:id/payments', (req,res) =>
  res.json(db.prepare('SELECT * FROM payments WHERE loan_id=? ORDER BY payment_date ASC').all(req.params.id)));
app.post('/api/loans/:id/payments', (req,res) => {
  const {payment_date,total_payment,principal,interest,escrow,extra_principal,ending_balance,statement_month,notes}=req.body;
  const r=db.prepare('INSERT INTO payments (loan_id,payment_date,total_payment,principal,interest,escrow,extra_principal,ending_balance,statement_month,notes) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(req.params.id,payment_date,total_payment,principal,interest,escrow,extra_principal,ending_balance,statement_month,notes);
  updateLoanBalance(req.params.id);
  res.json(db.prepare('SELECT * FROM payments WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/payments/:id', (req,res) => {
  const {payment_date,total_payment,principal,interest,escrow,extra_principal,ending_balance,statement_month,notes}=req.body;
  db.prepare('UPDATE payments SET payment_date=?,total_payment=?,principal=?,interest=?,escrow=?,extra_principal=?,ending_balance=?,statement_month=?,notes=? WHERE id=?')
    .run(payment_date,total_payment,principal,interest,escrow,extra_principal,ending_balance,statement_month,notes,req.params.id);
  const p=db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
  if(p)updateLoanBalance(p.loan_id);
  res.json(p);
});
app.delete('/api/payments/:id', (req,res) => {
  const p=db.prepare('SELECT loan_id FROM payments WHERE id=?').get(req.params.id);
  const docs=db.prepare('SELECT filename FROM loan_documents WHERE payment_id=?').all(req.params.id);
  docs.forEach(d=>{try{fs.unlinkSync(path.join(STATEMENTS_DIR,d.filename));}catch(e){}});
  db.prepare('DELETE FROM payments WHERE id=?').run(req.params.id);
  if(p)updateLoanBalance(p.loan_id);
  res.json({success:true});
});
app.get('/api/loans/:id/latest-balance', (req,res) => {
  const latest=db.prepare('SELECT ending_balance FROM payments WHERE loan_id=? ORDER BY payment_date DESC,created_at DESC LIMIT 1').get(req.params.id);
  const loan=db.prepare('SELECT original_amount FROM loans WHERE id=?').get(req.params.id);
  res.json({balance:latest?.ending_balance??loan?.original_amount??null});
});

// DOCUMENTS
app.get('/api/loans/:id/documents', (req,res) => {
  const {payment_id} = req.query;
  if (payment_id) {
    res.json(db.prepare('SELECT * FROM loan_documents WHERE loan_id=? AND payment_id=? ORDER BY uploaded_at DESC').all(req.params.id,payment_id));
  } else {
    res.json(db.prepare('SELECT * FROM loan_documents WHERE loan_id=? AND payment_id IS NULL AND escrow_item_id IS NULL AND bill_id IS NULL ORDER BY uploaded_at DESC').all(req.params.id));
  }
});
app.get('/api/loans/:id/all-documents', (req,res) =>
  res.json(db.prepare(`SELECT d.*,p.payment_date,p.statement_month FROM loan_documents d LEFT JOIN payments p ON d.payment_id=p.id WHERE d.loan_id=? ORDER BY d.uploaded_at DESC`).all(req.params.id)));
app.post('/api/loans/:id/documents', upload.single('file'), (req,res) => {
  if(!req.file)return res.status(400).json({error:'No file uploaded'});
  const {payment_id,escrow_item_id,doc_type,description}=req.body;
  const ext=path.extname(req.file.originalname);
  const filename=`doc-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,filename));
  const r=db.prepare('INSERT INTO loan_documents (loan_id,payment_id,escrow_item_id,filename,original_name,doc_type,description) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id,payment_id||null,escrow_item_id||null,filename,req.file.originalname,doc_type||'document',description||null);
  res.json(db.prepare('SELECT * FROM loan_documents WHERE id=?').get(r.lastInsertRowid));
});
app.delete('/api/documents/:id', (req,res) => {
  const doc=db.prepare('SELECT * FROM loan_documents WHERE id=?').get(req.params.id);
  if(!doc)return res.status(404).json({error:'Not found'});
  try{fs.unlinkSync(path.join(STATEMENTS_DIR,doc.filename));}catch(e){}
  db.prepare('DELETE FROM loan_documents WHERE id=?').run(req.params.id);
  res.json({success:true});
});
app.post('/api/payments/:id/attach-temp-pdf', (req,res) => {
  const {tempFilename}=req.body;
  if(!tempFilename)return res.status(400).json({error:'No filename'});
  const src=path.join(STATEMENTS_DIR,tempFilename);
  if(!fs.existsSync(src))return res.status(404).json({error:'Temp file not found'});
  const payment=db.prepare('SELECT * FROM payments WHERE id=?').get(req.params.id);
  if(!payment)return res.status(404).json({error:'Payment not found'});
  const finalName=`payment-${req.params.id}-${Date.now()}.pdf`;
  fs.renameSync(src,path.join(STATEMENTS_DIR,finalName));
  db.prepare('INSERT INTO loan_documents (loan_id,payment_id,filename,original_name,doc_type) VALUES (?,?,?,?,?)')
    .run(payment.loan_id,payment.id,finalName,'statement.pdf','statement');
  res.json({success:true,filename:finalName});
});

// STORE PDF WITHOUT AI
app.post('/api/loans/:id/store-pdf', upload.single('pdf'), (req,res) => {
  if(!req.file)return res.status(400).json({error:'No PDF'});
  const {payment_id,escrow_item_id,doc_type,description}=req.body;
  const ext=path.extname(req.file.originalname);
  const filename=`doc-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,filename));
  const r=db.prepare('INSERT INTO loan_documents (loan_id,payment_id,escrow_item_id,filename,original_name,doc_type,description) VALUES (?,?,?,?,?,?,?)')
    .run(req.params.id,payment_id||null,escrow_item_id||null,filename,req.file.originalname,doc_type||'statement',description||null);
  res.json({success:true,document:db.prepare('SELECT * FROM loan_documents WHERE id=?').get(r.lastInsertRowid)});
});

// ESCROW ITEMS
app.get('/api/loans/:id/escrow', (req,res) =>
  res.json(db.prepare('SELECT * FROM escrow_items WHERE loan_id=? ORDER BY payment_date DESC').all(req.params.id)));
app.post('/api/loans/:id/escrow', (req,res) => {
  const {item_type,description,amount,payment_date,year}=req.body;
  const r=db.prepare('INSERT INTO escrow_items (loan_id,item_type,description,amount,payment_date,year) VALUES (?,?,?,?,?,?)').run(req.params.id,item_type,description,amount,payment_date,year);
  res.json(db.prepare('SELECT * FROM escrow_items WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/escrow/:id', (req,res) => {
  const {item_type,description,amount,payment_date,year}=req.body;
  db.prepare('UPDATE escrow_items SET item_type=?,description=?,amount=?,payment_date=?,year=? WHERE id=?').run(item_type,description,amount,payment_date,year,req.params.id);
  res.json(db.prepare('SELECT * FROM escrow_items WHERE id=?').get(req.params.id));
});
app.delete('/api/escrow/:id', (req,res) => { db.prepare('DELETE FROM escrow_items WHERE id=?').run(req.params.id); res.json({success:true}); });

// ESCROW ACCOUNT SETUP
app.get('/api/loans/:id/escrow-account', (req,res) => {
  const acct = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id=?').get(req.params.id);
  res.json(acct || {loan_id:parseInt(req.params.id),starting_balance:0,target_balance:null,notes:null});
});
app.post('/api/loans/:id/escrow-account', (req,res) => {
  const {starting_balance,target_balance,notes}=req.body;
  db.prepare(`INSERT INTO escrow_accounts (loan_id,starting_balance,target_balance,notes,updated_at) VALUES (?,?,?,?,datetime('now'))
    ON CONFLICT(loan_id) DO UPDATE SET starting_balance=excluded.starting_balance,target_balance=excluded.target_balance,notes=excluded.notes,updated_at=excluded.updated_at`)
    .run(req.params.id,starting_balance||0,target_balance||null,notes||null);
  res.json(db.prepare('SELECT * FROM escrow_accounts WHERE loan_id=?').get(req.params.id));
});

// ESCROW ADJUSTMENTS (annual statement)
app.get('/api/loans/:id/escrow-adjustments', (req,res) =>
  res.json(db.prepare('SELECT * FROM escrow_adjustments WHERE loan_id=? ORDER BY effective_date ASC').all(req.params.id)));
app.post('/api/loans/:id/escrow-adjustments', (req,res) => {
  const {effective_date,new_monthly_escrow,new_target_balance,reason,notes}=req.body;
  const r=db.prepare('INSERT INTO escrow_adjustments (loan_id,effective_date,new_monthly_escrow,new_target_balance,reason,notes) VALUES (?,?,?,?,?,?)').run(req.params.id,effective_date,new_monthly_escrow,new_target_balance||null,reason||null,notes||null);
  res.json(db.prepare('SELECT * FROM escrow_adjustments WHERE id=?').get(r.lastInsertRowid));
});
app.delete('/api/escrow-adjustments/:id', (req,res) => { db.prepare('DELETE FROM escrow_adjustments WHERE id=?').run(req.params.id); res.json({success:true}); });

// ESCROW RUNNING BALANCE
app.get('/api/loans/:id/escrow-balance', (req,res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id=?').get(req.params.id);
  if(!loan) return res.status(404).json({error:'Loan not found'});
  const acct = db.prepare('SELECT * FROM escrow_accounts WHERE loan_id=?').get(req.params.id);
  const deposits = db.prepare('SELECT payment_date,escrow FROM payments WHERE loan_id=? AND escrow>0 ORDER BY payment_date ASC').all(req.params.id);
  const disbursements = db.prepare('SELECT payment_date,amount,item_type,description FROM escrow_items WHERE loan_id=? ORDER BY payment_date ASC').all(req.params.id);
  let balance = acct ? parseFloat(acct.starting_balance) : 0;
  const events = [];
  deposits.forEach(p => events.push({date:p.payment_date, type:'deposit', amount:parseFloat(p.escrow), description:'Monthly escrow deposit'}));
  disbursements.forEach(d => events.push({date:d.payment_date, type:'disbursement', amount:parseFloat(d.amount), description:d.description||d.item_type}));
  events.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const ledger = events.map(e => {
    if(e.type==='deposit') balance += e.amount;
    else balance -= e.amount;
    return {...e, running_balance: parseFloat(balance.toFixed(2))};
  });
  res.json({starting_balance:acct?.starting_balance||0, current_balance:parseFloat(balance.toFixed(2)), target_balance:acct?.target_balance||null, ledger});
});

// ESCROW DOCS AND PDF
app.get('/api/escrow/:id/documents', (req,res) =>
  res.json(db.prepare('SELECT * FROM loan_documents WHERE escrow_item_id=? ORDER BY uploaded_at DESC').all(req.params.id)));

app.post('/api/loans/:id/analyze-escrow-pdf', upload.single('pdf'), async (req,res) => {
  if(!req.file) return res.status(400).json({error:'No PDF'});
  const provider = req.body.provider||'claude';
  const keyMap = {claude:'claude_api_key',openai:'openai_api_key',gemini:'gemini_api_key',copilot:'copilot_api_key'};
  const apiKey = getSetting(keyMap[provider]);
  if(!apiKey){try{fs.unlinkSync(req.file.path);}catch(e){} return res.status(400).json({error:'No API key for '+provider});}
  try {
    const b64 = fs.readFileSync(req.file.path).toString('base64');
    const data = await extractFromPDF(provider, apiKey, b64, ESCROW_PDF_PROMPT);
    const tempFilename = `temp-${Date.now()}.pdf`;
    fs.renameSync(req.file.path, path.join(STATEMENTS_DIR,tempFilename));
    res.json({success:true, extracted:data, tempFilename});
  } catch(err) {
    try{if(req.file?.path)fs.unlinkSync(req.file.path);}catch(e){}
    res.status(500).json({error:err.message});
  }
});

// ANALYTICS
app.get('/api/loans/:id/analytics', (req,res) => {
  const loan=db.prepare('SELECT * FROM loans WHERE id=?').get(req.params.id);
  if(!loan)return res.status(404).json({error:'Loan not found'});
  const payments=db.prepare('SELECT * FROM payments WHERE loan_id=? ORDER BY payment_date ASC').all(req.params.id);
  const n=v=>parseFloat(v)||0; // safe number parser - never returns NaN
  const totalPaid=payments.reduce((s,p)=>s+n(p.total_payment),0);
  const totalPrincipalPaid=payments.reduce((s,p)=>s+n(p.principal)+n(p.extra_principal),0);
  const totalInterestPaid=payments.reduce((s,p)=>s+n(p.interest),0);
  const totalEscrowPaid=payments.reduce((s,p)=>s+n(p.escrow),0);
  const mostRecent=[...payments].sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date))[0];
  // Use ending_balance from most recent payment if available, otherwise derive from principal paid
  const currentBalance=mostRecent?.ending_balance!=null
    ? n(mostRecent.ending_balance)
    : Math.max(0, n(loan.original_amount)-totalPrincipalPaid);
  const monthlyRate=n(loan.interest_rate)/100/12;
  const monthlyPayment=n(loan.monthly_payment);
  let projectedMonths=0,remaining=currentBalance,projectedInterest=0;
  if(monthlyPayment>0){
    while(remaining>0.01&&projectedMonths<600){
      const ic=remaining*monthlyRate;
      const principal=monthlyPayment-ic;
      if(principal<=0)break; // payment doesn't cover interest - stop
      remaining=Math.max(0,remaining-principal);
      projectedInterest+=ic;
      projectedMonths++;
    }
  }
  const lastDate=mostRecent?new Date(mostRecent.payment_date):new Date(loan.start_date);
  const projectedPayoffDate=new Date(lastDate);
  projectedPayoffDate.setMonth(projectedPayoffDate.getMonth()+projectedMonths);
  let origBalance=n(loan.original_amount),origInterest=0,origMonths=0;
  if(monthlyPayment>0){
    while(origBalance>0.01&&origMonths<600){
      const ic=origBalance*monthlyRate;
      const principal=monthlyPayment-ic;
      if(principal<=0)break;
      origBalance=Math.max(0,origBalance-principal);
      origInterest+=ic;
      origMonths++;
    }
  }
  res.json({loan,totalPaid,totalPrincipalPaid,totalInterestPaid,totalEscrowPaid,currentBalance,projectedMonths,
    projectedPayoffDate:projectedPayoffDate.toISOString().split('T')[0],projectedRemainingInterest:projectedInterest,
    originalLoanTermMonths:loan.loan_term_months,originalTotalInterest:origInterest,
    monthsAhead:Math.max(0,loan.loan_term_months-payments.length-projectedMonths),paymentCount:payments.length});
});

// PAYOFF CALCULATOR
app.post('/api/loans/:id/calculate-payoff', (req,res) => {
  const loan=db.prepare('SELECT * FROM loans WHERE id=?').get(req.params.id);
  if(!loan)return res.status(404).json({error:'Loan not found'});
  const currentBalance=loan.current_balance||loan.original_amount;
  const monthlyRate=loan.interest_rate/100/12;
  const basePayment=loan.monthly_payment;
  const extraMonthly=parseFloat(req.body.extra_monthly)||0;
  const lumpSum=parseFloat(req.body.lump_sum)||0;
  const targetDates=req.body.target_dates||[];
  const calc=(startBal,payment)=>{
    if(payment<=startBal*monthlyRate)return null;
    let bal=startBal,months=0,totalInterest=0;
    while(bal>0.01&&months<600){const ic=bal*monthlyRate;bal-=Math.min(payment-ic,bal);totalInterest+=ic;months++;}
    return{months,totalInterest};
  };
  const now=new Date();
  const pd=(m)=>{const d=new Date(now);d.setMonth(d.getMonth()+m);return d.toISOString().split('T')[0];};
  const base=calc(currentBalance,basePayment);
  const monthly=extraMonthly>0?calc(currentBalance,basePayment+extraMonthly):null;
  const lump=lumpSum>0?calc(Math.max(0,currentBalance-lumpSum),basePayment):null;
  const combined=(extraMonthly>0&&lumpSum>0)?calc(Math.max(0,currentBalance-lumpSum),basePayment+extraMonthly):null;
  const targetResults=targetDates.map(dateStr=>{
    const target=new Date(dateStr);
    const monthsAvail=Math.round((target-now)/(1000*60*60*24*30.44));
    if(monthsAvail<=0)return{date:dateStr,impossible:true,reason:'Date is in the past'};
    if(!base||monthsAvail>=base.months)return{date:dateStr,impossible:true,reason:'Already on track to pay off before this date'};
    let lo=basePayment,hi=currentBalance*2,required=null;
    for(let i=0;i<60;i++){const mid=(lo+hi)/2;const r=calc(currentBalance,mid);if(!r){lo=mid;continue;}if(r.months<=monthsAvail){required=mid;hi=mid;}else lo=mid;}
    if(!required||required>currentBalance*1.5)return{date:dateStr,impossible:true,reason:'Would require unrealistically large payments'};
    const result=calc(currentBalance,required);
    return{date:dateStr,impossible:false,monthsAvail,extraMonthlyNeeded:required-basePayment,totalPayment:required,
      totalInterest:result.totalInterest,interestSaved:base?base.totalInterest-result.totalInterest:0,monthsSaved:base?base.months-result.months:0};
  });
  const armScenarios=[];
  if(loan.loan_type==='arm'&&loan.arm_rate_cap&&loan.arm_rate_floor){
    const worstRate=Math.min(loan.arm_rate_cap,loan.interest_rate+(loan.arm_periodic_cap||2)*3);
    [{label:'Worst case (rate cap)',rate:worstRate},{label:'Current rate',rate:loan.interest_rate},{label:'Best case (rate floor)',rate:loan.arm_rate_floor}].forEach(sc=>{
      const r=sc.rate/100/12;let bal=currentBalance,months=0,ti=0;
      while(bal>0.01&&months<600){const ic=bal*r;bal-=Math.min(basePayment-ic,bal);ti+=ic;months++;}
      armScenarios.push({...sc,months,totalInterest:ti,payoffDate:pd(months)});
    });
  }
  res.json({
    base:base?{months:base.months,totalInterest:base.totalInterest,payoffDate:pd(base.months)}:null,
    monthly:monthly?{months:monthly.months,totalInterest:monthly.totalInterest,payoffDate:pd(monthly.months)}:null,
    lump:lump?{months:lump.months,totalInterest:lump.totalInterest,payoffDate:pd(lump.months)}:null,
    combined:combined?{months:combined.months,totalInterest:combined.totalInterest,payoffDate:pd(combined.months)}:null,
    savings:{
      monthly:monthly&&base?{months:base.months-monthly.months,interest:base.totalInterest-monthly.totalInterest}:null,
      lump:lump&&base?{months:base.months-lump.months,interest:base.totalInterest-lump.totalInterest}:null,
      combined:combined&&base?{months:base.months-combined.months,interest:base.totalInterest-combined.totalInterest}:null,
    },
    targetResults,armScenarios,
  });
});

// PDF PROCESSING (payments AI)
app.post('/api/loans/:id/process-pdf', upload.single('pdf'), async (req,res) => {
  if(!req.file)return res.status(400).json({error:'No PDF'});
  const provider=req.body.provider||'claude';
  const keyMap={claude:'claude_api_key',openai:'openai_api_key',gemini:'gemini_api_key',copilot:'copilot_api_key'};
  const apiKey=getSetting(keyMap[provider]);
  if(!apiKey){try{fs.unlinkSync(req.file.path);}catch(e){}return res.status(400).json({error:'No API key for '+provider});}
  try{
    const b64=fs.readFileSync(req.file.path).toString('base64');
    const data=await extractFromPDF(provider, apiKey, b64, PDF_PROMPT);
    const tempFilename=`temp-${Date.now()}.pdf`;
    fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,tempFilename));
    res.json({success:true,extracted:data,provider,tempFilename});
  }catch(err){
    try{if(req.file?.path)fs.unlinkSync(req.file.path);}catch(e){}
    res.status(500).json({error:err.message});
  }
});

// BILL CATEGORIES
app.get('/api/bills/categories', (req,res) => res.json(db.prepare('SELECT * FROM bill_categories ORDER BY name ASC').all()));
app.post('/api/bills/categories', (req,res) => {
  const {name,icon,color,custom_fields,cycle}=req.body;
  const r=db.prepare('INSERT INTO bill_categories (name,icon,color,custom_fields,cycle) VALUES (?,?,?,?,?)').run(name,icon||'💡',color||'#7B8FA1',custom_fields?JSON.stringify(custom_fields):null,cycle||'monthly');
  res.json(db.prepare('SELECT * FROM bill_categories WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/bills/categories/:id', (req,res) => {
  const {name,icon,color,custom_fields,cycle}=req.body;
  db.prepare('UPDATE bill_categories SET name=?,icon=?,color=?,custom_fields=?,cycle=? WHERE id=?').run(name,icon||'💡',color||'#7B8FA1',custom_fields?JSON.stringify(custom_fields):null,cycle||'monthly',req.params.id);
  res.json(db.prepare('SELECT * FROM bill_categories WHERE id=?').get(req.params.id));
});
app.delete('/api/bills/categories/:id', (req,res) => { db.prepare('DELETE FROM bill_categories WHERE id=?').run(req.params.id); res.json({success:true}); });

// BILLS
app.get('/api/bills', (req,res) => {
  const {category_id}=req.query;
  const sql=category_id
    ?'SELECT b.*,bc.name cat_name,bc.icon cat_icon,bc.color cat_color,bc.custom_fields FROM bills b JOIN bill_categories bc ON b.category_id=bc.id WHERE b.category_id=? ORDER BY b.bill_date DESC'
    :'SELECT b.*,bc.name cat_name,bc.icon cat_icon,bc.color cat_color,bc.custom_fields FROM bills b JOIN bill_categories bc ON b.category_id=bc.id ORDER BY b.bill_date DESC';
  res.json(category_id ? db.prepare(sql).all(category_id) : db.prepare(sql).all());
});
app.post('/api/bills', (req,res) => {
  const {category_id,bill_date,amount,due_date,paid,notes,custom_data}=req.body;
  const r=db.prepare('INSERT INTO bills (category_id,bill_date,amount,due_date,paid,notes,custom_data) VALUES (?,?,?,?,?,?,?)').run(category_id,bill_date,amount,due_date||null,paid?1:0,notes||null,custom_data?JSON.stringify(custom_data):null);
  res.json(db.prepare('SELECT * FROM bills WHERE id=?').get(r.lastInsertRowid));
});
app.put('/api/bills/:id', (req,res) => {
  const {category_id,bill_date,amount,due_date,paid,notes,custom_data}=req.body;
  db.prepare('UPDATE bills SET category_id=?,bill_date=?,amount=?,due_date=?,paid=?,notes=?,custom_data=? WHERE id=?').run(category_id,bill_date,amount,due_date||null,paid?1:0,notes||null,custom_data?JSON.stringify(custom_data):null,req.params.id);
  res.json(db.prepare('SELECT * FROM bills WHERE id=?').get(req.params.id));
});
app.delete('/api/bills/:id', (req,res) => {
  const docs=db.prepare('SELECT filename FROM loan_documents WHERE bill_id=?').all(req.params.id);
  docs.forEach(d=>{try{fs.unlinkSync(path.join(STATEMENTS_DIR,d.filename));}catch(e){}});
  db.prepare('DELETE FROM bills WHERE id=?').run(req.params.id);
  res.json({success:true});
});

// BILL DOCUMENTS
app.get('/api/bills/:id/documents', (req,res) =>
  res.json(db.prepare('SELECT * FROM loan_documents WHERE bill_id=? ORDER BY uploaded_at DESC').all(req.params.id)));
app.post('/api/bills/:id/documents', upload.single('file'), (req,res) => {
  if(!req.file)return res.status(400).json({error:'No file'});
  const ext=path.extname(req.file.originalname);
  const filename=`bill-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,filename));
  const r=db.prepare('INSERT INTO loan_documents (loan_id,bill_id,filename,original_name,doc_type,description) VALUES (?,?,?,?,?,?)').run(null,req.params.id,filename,req.file.originalname,'bill',req.body.description||null);
  res.json(db.prepare('SELECT * FROM loan_documents WHERE id=?').get(r.lastInsertRowid));
});

// BILL PDF AI ANALYSIS
app.post('/api/bills/:id/analyze-pdf', upload.single('pdf'), async (req,res) => {
  if(!req.file)return res.status(400).json({error:'No PDF'});
  const provider=req.body.provider||'claude';
  const keyMap={claude:'claude_api_key',openai:'openai_api_key',gemini:'gemini_api_key',copilot:'copilot_api_key'};
  const apiKey=getSetting(keyMap[provider]);
  if(!apiKey){try{fs.unlinkSync(req.file.path);}catch(e){}return res.status(400).json({error:'No API key for '+provider});}
  try{
    const b64=fs.readFileSync(req.file.path).toString('base64');
    const data=await extractFromPDF(provider, apiKey, b64, BILL_PDF_PROMPT);
    const tempFilename=`temp-${Date.now()}.pdf`;
    fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,tempFilename));
    res.json({success:true,extracted:data,tempFilename});
  }catch(err){
    try{if(req.file?.path)fs.unlinkSync(req.file.path);}catch(e){}
    res.status(500).json({error:err.message});
  }
});

// ─── ALL DOCUMENTS (CONTAINER-WIDE) ──────────────────────────────────────────
app.get('/api/documents', auth, (req,res) => {
  const rows = db.prepare(`
    SELECT d.*,
      l.name as loan_name, l.id as loan_id,
      p.payment_date, p.statement_month,
      b.amount as bill_amount,
      bc.name as bill_category_name, bc.icon as bill_category_icon
    FROM loan_documents d
    LEFT JOIN loans l ON d.loan_id=l.id
    LEFT JOIN payments p ON d.payment_id=p.id
    LEFT JOIN bills b ON d.bill_id=b.id
    LEFT JOIN bill_categories bc ON b.category_id=bc.id
    ORDER BY d.uploaded_at DESC
  `).all();
  res.json(rows);
});

// Edit document metadata (name, description, payment link)
app.put('/api/documents/:id', auth, (req,res) => {
  const {original_name, description, payment_id, paperless_url} = req.body;
  const doc = db.prepare('SELECT * FROM loan_documents WHERE id=?').get(req.params.id);
  if(!doc) return res.status(404).json({error:'Not found'});
  db.prepare(`UPDATE loan_documents SET
    original_name=COALESCE(?,original_name),
    description=COALESCE(?,description),
    payment_id=?,
    paperless_url=?
    WHERE id=?`).run(original_name||null, description||null, payment_id||null, paperless_url||null, req.params.id);
  res.json(db.prepare('SELECT * FROM loan_documents WHERE id=?').get(req.params.id));
});

// ─── ALL LOANS SUMMARY (DASHBOARD) ───────────────────────────────────────────
app.get('/api/dashboard', auth, (req,res) => {
  const loans = db.prepare('SELECT * FROM loans ORDER BY created_at DESC').all();
  const loanSummaries = loans.map(loan => {
    const payments = db.prepare('SELECT * FROM payments WHERE loan_id=? ORDER BY payment_date ASC').all(loan.id);
    const totalPaid = payments.reduce((s,p)=>s+(p.total_payment||0),0);
    const totalPrincipal = payments.reduce((s,p)=>s+(p.principal||0),0);
    const totalInterest = payments.reduce((s,p)=>s+(p.interest||0),0);
    const totalEscrow = payments.reduce((s,p)=>s+(p.escrow||0),0);
    const currentBalance = parseFloat(loan.current_balance || loan.original_amount);
    const progress = ((parseFloat(loan.original_amount)-currentBalance)/parseFloat(loan.original_amount))*100;
    return { ...loan, paymentCount:payments.length, totalPaid, totalPrincipal, totalInterest, totalEscrow, currentBalance, progress:Math.max(0,Math.min(100,progress)) };
  });

  // Combined payment timeline across all loans (last 24 months)
  const allPayments = db.prepare(`
    SELECT p.*, l.name as loan_name, l.loan_type
    FROM payments p JOIN loans l ON p.loan_id=l.id
    ORDER BY p.payment_date ASC
  `).all();

  // Group by month for the combined chart
  const monthMap = {};
  allPayments.forEach(p => {
    const month = (p.statement_month || p.payment_date?.slice(0,7) || '');
    if(!monthMap[month]) monthMap[month]={month,total:0,principal:0,interest:0,escrow:0,extra:0};
    monthMap[month].total += parseFloat(p.total_payment||0);
    monthMap[month].principal += parseFloat(p.principal||0);
    monthMap[month].interest += parseFloat(p.interest||0);
    monthMap[month].escrow += parseFloat(p.escrow||0);
    monthMap[month].extra += parseFloat(p.extra_principal||0);
  });
  const paymentTimeline = Object.values(monthMap).sort((a,b)=>a.month.localeCompare(b.month)).slice(-24);

  // Bills summary
  const billCategories = db.prepare('SELECT * FROM bill_categories').all();
  const allBills = db.prepare('SELECT b.*, bc.name as cat_name, bc.icon as cat_icon, bc.color as cat_color FROM bills b JOIN bill_categories bc ON b.category_id=bc.id ORDER BY b.bill_date DESC').all();
  const billSummary = billCategories.map(cat => {
    const catBills = allBills.filter(b=>b.category_id===cat.id);
    const total = catBills.reduce((s,b)=>s+parseFloat(b.amount||0),0);
    const lastBill = catBills[0];
    return { ...cat, billCount:catBills.length, totalSpent:total, lastAmount:lastBill?.amount, lastDate:lastBill?.bill_date };
  });

  // Bills timeline (last 12 months, by category)
  const billTimelineMap = {};
  allBills.forEach(b => {
    const month = b.bill_date?.slice(0,7)||'';
    if(!billTimelineMap[month]) billTimelineMap[month]={month};
    billTimelineMap[month][b.cat_name] = (billTimelineMap[month][b.cat_name]||0)+parseFloat(b.amount||0);
  });
  const billTimeline = Object.values(billTimelineMap).sort((a,b)=>a.month.localeCompare(b.month)).slice(-12);

  res.json({ loanSummaries, paymentTimeline, billSummary, billTimeline, billCategories });
});

// ─── PAYMENTS FOR ALL LOANS (for document linking) ──────────────────────────
app.get('/api/payments', auth, (req,res) => {
  const rows = db.prepare(`SELECT p.*, l.name as loan_name FROM payments p JOIN loans l ON p.loan_id=l.id ORDER BY p.payment_date DESC LIMIT 200`).all();
  res.json(rows);
});

const PORT=process.env.PORT||3001;
app.listen(PORT,()=>console.log('PayoffIQ backend on port '+PORT));

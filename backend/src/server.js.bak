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
  CREATE TABLE IF NOT EXISTS loan_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    loan_id INTEGER REFERENCES loans(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    doc_type TEXT DEFAULT 'document',
    description TEXT,
    uploaded_at TEXT DEFAULT (datetime('now'))
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

function parseAI(text) { return JSON.parse(text.trim().replace(/```json|```/g,'').trim()); }

async function extractWithClaude(apiKey, b64) {
  const c = new Anthropic({ apiKey });
  const r = await c.messages.create({ model:'claude-opus-4-6', max_tokens:1024,
    messages:[{role:'user',content:[{type:'document',source:{type:'base64',media_type:'application/pdf',data:b64}},{type:'text',text:PDF_PROMPT}]}]});
  return parseAI(r.content[0].text);
}
async function extractWithOpenAI(apiKey, b64) {
  const c = new OpenAI({ apiKey });
  const r = await c.chat.completions.create({ model:'gpt-4o', max_tokens:1024,
    messages:[{role:'user',content:[{type:'file',file:{filename:'statement.pdf',file_data:'data:application/pdf;base64,'+b64}},{type:'text',text:PDF_PROMPT}]}]});
  return parseAI(r.choices[0].message.content);
}
async function extractWithGemini(apiKey, b64) {
  const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({model:'gemini-2.0-flash'});
  const r = await m.generateContent([{inlineData:{mimeType:'application/pdf',data:b64}},PDF_PROMPT]);
  return parseAI(r.response.text());
}
async function extractWithCopilot(apiKey, b64) {
  const c = new OpenAI({apiKey,baseURL:'https://models.inference.ai.azure.com'});
  const r = await c.chat.completions.create({model:'gpt-4o',max_tokens:1024,
    messages:[{role:'user',content:[{type:'file',file:{filename:'statement.pdf',file_data:'data:application/pdf;base64,'+b64}},{type:'text',text:PDF_PROMPT}]}]});
  return parseAI(r.choices[0].message.content);
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

// ─── PUBLIC AUTH ROUTES ───────────────────────────────────────────────────────
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

// Generate a one-time reset token — accessible from the server's local network only
// Usage: GET http://your-server:3010/api/auth/generate-reset-token
app.get('/api/auth/generate-reset-token', (req, res) => {
  const user = db.prepare('SELECT * FROM users LIMIT 1').get();
  if (!user) return res.status(404).json({ error: 'No user account found' });
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
  db.prepare('UPDATE users SET reset_token=?, reset_token_expires=? WHERE id=?').run(token, expires, user.id);
  const resetUrl = `/reset-password?token=${token}`;
  res.json({
    message: 'Reset token generated. Open the URL below in your browser within 15 minutes.',
    reset_url: resetUrl,
    full_url: `(open PayoffIQ in your browser and navigate to: ${resetUrl})`
  });
});

// Validate a reset token (used by the frontend reset page)
app.get('/api/auth/validate-reset-token', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  if (new Date(user.reset_token_expires) < new Date())
    return res.status(400).json({ error: 'Token expired — generate a new one' });
  res.json({ valid: true, username: user.username });
});

// Consume the token and set a new password
app.post('/api/auth/reset-password', (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Token and new password (min 6 chars) required' });
  const user = db.prepare('SELECT * FROM users WHERE reset_token=?').get(token);
  if (!user) return res.status(400).json({ error: 'Invalid or expired token' });
  if (new Date(user.reset_token_expires) < new Date())
    return res.status(400).json({ error: 'Token expired — generate a new one' });
  db.prepare('UPDATE users SET password_hash=?, reset_token=NULL, reset_token_expires=NULL WHERE id=?')
    .run(bcrypt.hashSync(newPassword, 10), user.id);
  res.json({ success: true, message: 'Password updated — you can now log in' });
});

// ─── PROTECTED ROUTES ─────────────────────────────────────────────────────────
app.use('/api', auth);

app.post('/api/auth/change-password', (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username=?').get(req.user.username);
  if (!bcrypt.compareSync(currentPassword, user.password_hash))
    return res.status(401).json({ error:'Current password incorrect' });
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error:'Min 6 characters' });
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
  const allowed=['claude_api_key','openai_api_key','gemini_api_key','copilot_api_key'];
  const updates=[];
  for(const [k,v] of Object.entries(req.body)){if(!allowed.includes(k))continue;if(v&&v!=='••••••••••••••••'){setSetting(k,v);updates.push(k);}}
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
app.delete('/api/arm-rates/:id', (req,res) => {
  db.prepare('DELETE FROM arm_rate_history WHERE id=?').run(req.params.id);
  res.json({success:true});
});

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
    res.json(db.prepare('SELECT * FROM loan_documents WHERE loan_id=? AND payment_id IS NULL ORDER BY uploaded_at DESC').all(req.params.id));
  }
});
app.get('/api/loans/:id/all-documents', (req,res) =>
  res.json(db.prepare(`SELECT d.*,p.payment_date,p.statement_month FROM loan_documents d LEFT JOIN payments p ON d.payment_id=p.id WHERE d.loan_id=? ORDER BY d.uploaded_at DESC`).all(req.params.id)));
app.post('/api/loans/:id/documents', upload.single('file'), (req,res) => {
  if(!req.file)return res.status(400).json({error:'No file uploaded'});
  const {payment_id,doc_type,description}=req.body;
  const ext=path.extname(req.file.originalname);
  const filename=`doc-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,filename));
  const r=db.prepare('INSERT INTO loan_documents (loan_id,payment_id,filename,original_name,doc_type,description) VALUES (?,?,?,?,?,?)')
    .run(req.params.id,payment_id||null,filename,req.file.originalname,doc_type||'document',description||null);
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

// ESCROW
app.get('/api/loans/:id/escrow', (req,res) =>
  res.json(db.prepare('SELECT * FROM escrow_items WHERE loan_id=? ORDER BY payment_date DESC').all(req.params.id)));
app.post('/api/loans/:id/escrow', (req,res) => {
  const {item_type,description,amount,payment_date,year}=req.body;
  const r=db.prepare('INSERT INTO escrow_items (loan_id,item_type,description,amount,payment_date,year) VALUES (?,?,?,?,?,?)').run(req.params.id,item_type,description,amount,payment_date,year);
  res.json(db.prepare('SELECT * FROM escrow_items WHERE id=?').get(r.lastInsertRowid));
});
app.delete('/api/escrow/:id', (req,res) => { db.prepare('DELETE FROM escrow_items WHERE id=?').run(req.params.id); res.json({success:true}); });

// ANALYTICS
app.get('/api/loans/:id/analytics', (req,res) => {
  const loan=db.prepare('SELECT * FROM loans WHERE id=?').get(req.params.id);
  if(!loan)return res.status(404).json({error:'Loan not found'});
  const payments=db.prepare('SELECT * FROM payments WHERE loan_id=? ORDER BY payment_date ASC').all(req.params.id);
  const totalPaid=payments.reduce((s,p)=>s+p.total_payment,0);
  const totalPrincipalPaid=payments.reduce((s,p)=>s+p.principal+p.extra_principal,0);
  const totalInterestPaid=payments.reduce((s,p)=>s+p.interest,0);
  const totalEscrowPaid=payments.reduce((s,p)=>s+p.escrow,0);
  const mostRecent=[...payments].sort((a,b)=>new Date(b.payment_date)-new Date(a.payment_date))[0];
  const currentBalance=mostRecent?.ending_balance??(loan.original_amount-totalPrincipalPaid);
  const monthlyRate=loan.interest_rate/100/12;
  let projectedMonths=0,remaining=currentBalance,projectedInterest=0;
  while(remaining>0.01&&projectedMonths<600){const ic=remaining*monthlyRate;remaining-=Math.min(loan.monthly_payment-ic,remaining);projectedInterest+=ic;projectedMonths++;}
  const lastDate=mostRecent?new Date(mostRecent.payment_date):new Date(loan.start_date);
  const projectedPayoffDate=new Date(lastDate);
  projectedPayoffDate.setMonth(projectedPayoffDate.getMonth()+projectedMonths);
  let origBalance=loan.original_amount,origInterest=0,origMonths=0;
  while(origBalance>0.01&&origMonths<600){const ic=origBalance*monthlyRate;origBalance-=(loan.monthly_payment-ic);origInterest+=ic;origMonths++;}
  res.json({loan,totalPaid,totalPrincipalPaid,totalInterestPaid,totalEscrowPaid,currentBalance,projectedMonths,
    projectedPayoffDate:projectedPayoffDate.toISOString().split('T')[0],projectedRemainingInterest:projectedInterest,
    originalLoanTermMonths:loan.loan_term_months,originalTotalInterest:origInterest,
    monthsAhead:loan.loan_term_months-payments.length-projectedMonths,paymentCount:payments.length});
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

  // Payoff-by-date
  const targetResults=targetDates.map(dateStr=>{
    const target=new Date(dateStr);
    const monthsAvail=Math.round((target-now)/(1000*60*60*24*30.44));
    if(monthsAvail<=0)return{date:dateStr,impossible:true,reason:'Date is in the past'};
    if(!base||monthsAvail>=base.months)return{date:dateStr,impossible:true,reason:'Already on track to pay off before this date'};
    let lo=basePayment,hi=currentBalance*2,required=null;
    for(let i=0;i<60;i++){
      const mid=(lo+hi)/2;
      const r=calc(currentBalance,mid);
      if(!r){lo=mid;continue;}
      if(r.months<=monthsAvail){required=mid;hi=mid;}else lo=mid;
    }
    if(!required||required>currentBalance*1.5)return{date:dateStr,impossible:true,reason:'Would require unrealistically large payments'};
    const result=calc(currentBalance,required);
    return{date:dateStr,impossible:false,monthsAvail,extraMonthlyNeeded:required-basePayment,totalPayment:required,
      totalInterest:result.totalInterest,interestSaved:base?base.totalInterest-result.totalInterest:0,monthsSaved:base?base.months-result.months:0};
  });

  // ARM scenarios
  const armScenarios=[];
  if(loan.loan_type==='arm'&&loan.arm_rate_cap&&loan.arm_rate_floor){
    const worstRate=Math.min(loan.arm_rate_cap,loan.interest_rate+(loan.arm_periodic_cap||2)*3);
    [
      {label:'Worst case (rate cap)',rate:worstRate},
      {label:'Current rate',rate:loan.interest_rate},
      {label:'Best case (rate floor)',rate:loan.arm_rate_floor},
    ].forEach(sc=>{
      const r=sc.rate/100/12;
      let bal=currentBalance,months=0,ti=0;
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

// PDF PROCESSING
app.post('/api/loans/:id/process-pdf', upload.single('pdf'), async (req,res) => {
  if(!req.file)return res.status(400).json({error:'No PDF uploaded'});
  const provider=req.body.provider||'claude';
  const keyMap={claude:'claude_api_key',openai:'openai_api_key',gemini:'gemini_api_key',copilot:'copilot_api_key'};
  const apiKey=getSetting(keyMap[provider]);
  if(!apiKey){try{fs.unlinkSync(req.file.path);}catch(e){}return res.status(400).json({error:'No API key for '+provider});}
  try{
    const b64=fs.readFileSync(req.file.path).toString('base64');
    let data;
    if(provider==='claude')data=await extractWithClaude(apiKey,b64);
    else if(provider==='openai')data=await extractWithOpenAI(apiKey,b64);
    else if(provider==='gemini')data=await extractWithGemini(apiKey,b64);
    else if(provider==='copilot')data=await extractWithCopilot(apiKey,b64);
    else throw new Error('Unknown provider');
    const tempFilename=`temp-${Date.now()}.pdf`;
    fs.renameSync(req.file.path,path.join(STATEMENTS_DIR,tempFilename));
    res.json({success:true,extracted:data,provider,tempFilename});
  }catch(err){
    console.error('PDF error:',err);
    try{if(req.file?.path)fs.unlinkSync(req.file.path);}catch(e){}
    res.status(500).json({error:err.message});
  }
});

const PORT=process.env.PORT||3001;
app.listen(PORT,()=>console.log('MortgageIQ backend on port '+PORT));

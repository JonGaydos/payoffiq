import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCurrency } from '../../contexts/CurrencyContext';
import { API_BASE } from '../../utils/api';
import { fmtDate } from '../../utils/formatters';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Field from '../../components/ui/Field';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'medical', label: 'Medical' },
  { value: 'tax', label: 'Tax' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'receipt', label: 'Receipt' },
];

export default function DocumentsPage() {
  const { authFetch, token } = useAuth();
  const { fmt } = useCurrency();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(null);
  const [reviewDoc, setReviewDoc] = useState(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({ title: '', url: '', category: 'general', notes: '' });
  const [pushingToPaperless, setPushingToPaperless] = useState(null);
  const [paperlessConfigured, setPaperlessConfigured] = useState(false);
  const fileRef = useRef();

  const loadDocs = async () => {
    const url = filter ? `${API_BASE}/documents?category=${filter}` : `${API_BASE}/documents`;
    const res = await authFetch(url);
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [filter]);

  // Check if Paperless-NGX is configured
  useEffect(() => {
    authFetch(`${API_BASE}/settings`).then(async r => {
      if (r.ok) {
        const settings = await r.json();
        setPaperlessConfigured(!!(settings.paperless_url && settings.paperless_api_key));
      }
    });
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'general');

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (res.ok) {
      const result = await res.json();
      loadDocs();
      // Auto-extract with AI if available
      handleExtract(result.id);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleExtract = async (id) => {
    setExtracting(id);
    const res = await authFetch(`${API_BASE}/documents/${id}/extract`, { method: 'POST' });
    if (res.ok) {
      const result = await res.json();
      if (result.data) loadDocs();
    }
    setExtracting(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this document?')) return;
    await authFetch(`${API_BASE}/documents/${id}`, { method: 'DELETE' });
    loadDocs();
  };

  const handleUpdateDoc = async (id, updates) => {
    await authFetch(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    setReviewDoc(null);
    loadDocs();
  };

  const handleLinkDocument = async () => {
    if (!linkForm.title || !linkForm.url) return;
    const res = await authFetch(`${API_BASE}/documents/link`, {
      method: 'POST',
      body: JSON.stringify(linkForm),
    });
    if (res.ok) {
      setShowLinkForm(false);
      setLinkForm({ title: '', url: '', category: 'general', notes: '' });
      loadDocs();
    }
  };

  const handlePushToPaperless = async (id) => {
    setPushingToPaperless(id);
    const res = await authFetch(`${API_BASE}/documents/${id}/push-to-paperless`, { method: 'POST' });
    if (res.ok) {
      alert('Document sent to Paperless-NGX!');
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Error: ${err.error || 'Failed to push to Paperless-NGX'}`);
    }
    setPushingToPaperless(null);
  };

  if (loading) return <div className="text-warm-gray text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-serif text-2xl font-bold">Documents</h1>
        <div className="flex gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading...' : '+ Upload Document'}
          </Button>
          <Button variant="outline" onClick={() => setShowLinkForm(!showLinkForm)}>
            {showLinkForm ? 'Cancel' : '\u{1F517} Link URL'}
          </Button>
        </div>
      </div>

      {/* Link External Document Form */}
      {showLinkForm && (
        <Card accent="var(--color-gold)">
          <h3 className="font-serif font-bold mb-3">Link External Document</h3>
          <p className="text-xs text-warm-gray mb-4">Link to a Paperless-NGX document or any external URL.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Title *">
              <input className="input-field" placeholder="Document name" value={linkForm.title} onChange={e => setLinkForm(f => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="URL *">
              <input className="input-field" placeholder="https://paperless.example.com/documents/123" value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} />
            </Field>
            <Field label="Category">
              <select className="input-field" value={linkForm.category} onChange={e => setLinkForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Notes">
              <input className="input-field" placeholder="Optional" value={linkForm.notes} onChange={e => setLinkForm(f => ({ ...f, notes: e.target.value }))} />
            </Field>
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={handleLinkDocument}>Save Link</Button>
            <Button variant="ghost" onClick={() => setShowLinkForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            !filter ? 'bg-gold/20 text-gold border border-gold' : 'border border-card-border text-warm-gray hover:border-gold'
          }`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setFilter(c.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filter === c.value ? 'bg-gold/20 text-gold border border-gold' : 'border border-card-border text-warm-gray hover:border-gold'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* AI Review Panel */}
      {reviewDoc && (
        <AiReviewPanel
          doc={reviewDoc}
          fmt={fmt}
          onSave={(updates) => handleUpdateDoc(reviewDoc.id, updates)}
          onCancel={() => setReviewDoc(null)}
        />
      )}

      {/* Documents Grid */}
      {docs.length === 0 ? (
        <Card>
          <p className="text-warm-gray text-center py-6">
            No documents yet. Upload PDFs or images to get started with AI-powered extraction.
          </p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map(doc => {
            const extracted = doc.ai_extracted || {};
            const isImage = doc.mime_type?.startsWith('image/');
            const isLink = doc.mime_type === 'application/link';

            return (
              <Card key={doc.id} className="relative">
                {/* File preview area */}
                <div className="bg-cream/30 rounded-lg p-4 mb-3 text-center min-h-[80px] flex items-center justify-center">
                  {isLink ? (
                    <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline flex flex-col items-center">
                      <div className="text-3xl mb-1">{'\u{1F517}'}</div>
                      <span className="text-xs truncate max-w-[200px]">{doc.file_path}</span>
                    </a>
                  ) : isImage ? (
                    <img
                      src={`${API_BASE.replace('/api', '')}/uploads/${doc.file_path?.split('uploads/')[1] || doc.filename}`}
                      alt={doc.original_name}
                      className="max-h-24 rounded"
                    />
                  ) : (
                    <div className="text-3xl">{'\u{1F4C4}'}</div>
                  )}
                </div>

                <h3 className="font-semibold text-sm truncate" title={doc.original_name}>
                  {doc.original_name}
                </h3>
                <div className="text-xs text-warm-gray mt-1">
                  {fmtDate(doc.uploaded_at)} {isLink ? '\u2022 External Link' : `\u2022 ${formatFileSize(doc.file_size)}`}
                </div>

                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <Badge color={doc.category === 'general' ? 'gray' : 'orange'}>{doc.category}</Badge>
                  {isLink && <Badge color="blue">Link</Badge>}
                  {doc.ai_confidence != null && (
                    <Badge color={doc.ai_confidence >= 80 ? 'green' : doc.ai_confidence >= 50 ? 'orange' : 'red'}>
                      AI: {doc.ai_confidence}%
                    </Badge>
                  )}
                </div>

                {/* Extracted summary */}
                {extracted.biller && (
                  <div className="mt-2 p-2 bg-sage/10 rounded text-xs">
                    <div className="font-semibold">{extracted.biller}</div>
                    {extracted.amount && <div>Amount: {fmt(extracted.amount)}</div>}
                    {extracted.due_date && <div>Due: {extracted.due_date}</div>}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {!isLink && !doc.ai_extracted?.biller && (
                    <Button
                      variant="sm"
                      className="border border-gold text-gold hover:bg-gold/10 flex-1"
                      onClick={() => handleExtract(doc.id)}
                      disabled={extracting === doc.id}
                    >
                      {extracting === doc.id ? 'Extracting...' : 'AI Extract'}
                    </Button>
                  )}
                  {!isLink && paperlessConfigured && (
                    <Button
                      variant="sm"
                      className="border border-card-border text-warm-gray hover:border-sage hover:text-sage flex-1"
                      onClick={() => handlePushToPaperless(doc.id)}
                      disabled={pushingToPaperless === doc.id}
                    >
                      {pushingToPaperless === doc.id ? 'Sending...' : '\u{1F4E4} Paperless'}
                    </Button>
                  )}
                  {isLink && (
                    <a href={doc.file_path} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="sm" className="border border-gold text-gold hover:bg-gold/10 w-full">
                        Open Link
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="sm"
                    className="border border-card-border text-warm-gray hover:border-gold flex-1"
                    onClick={() => setReviewDoc(doc)}
                  >
                    Review
                  </Button>
                  <button onClick={() => handleDelete(doc.id)} className="text-xs text-warm-gray hover:text-danger px-1">
                    Del
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AiReviewPanel({ doc, fmt, onSave, onCancel }) {
  const extracted = doc.ai_extracted || {};
  const [form, setForm] = useState({
    category: doc.category || 'general',
    subcategory: doc.subcategory || '',
    notes: doc.notes || '',
    ai_extracted: {
      biller: extracted.biller || '',
      bill_date: extracted.bill_date || '',
      due_date: extracted.due_date || '',
      amount: extracted.amount || '',
      account_number: extracted.account_number || '',
      category: extracted.category || '',
      summary: extracted.summary || '',
    },
  });

  const set = (k, v) => setForm({ ...form, [k]: v });
  const setExtracted = (k, v) => setForm({ ...form, ai_extracted: { ...form.ai_extracted, [k]: v } });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      category: form.category,
      subcategory: form.subcategory,
      notes: form.notes,
      ai_extracted: form.ai_extracted,
    });
  };

  return (
    <Card accent="var(--color-gold)">
      <h3 className="font-serif font-bold mb-1">Review: {doc.original_name}</h3>
      {doc.ai_confidence != null && (
        <p className="text-xs text-warm-gray mb-4">
          AI Confidence: {doc.ai_confidence}% ({doc.ai_provider})
        </p>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Category">
          <select className="input-field" value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Biller">
          <input className="input-field" value={form.ai_extracted.biller} onChange={e => setExtracted('biller', e.target.value)} />
        </Field>
        <Field label="Amount">
          <input type="number" step="0.01" className="input-field" value={form.ai_extracted.amount} onChange={e => setExtracted('amount', e.target.value)} />
        </Field>
        <Field label="Bill Date">
          <input type="date" className="input-field" value={form.ai_extracted.bill_date} onChange={e => setExtracted('bill_date', e.target.value)} />
        </Field>
        <Field label="Due Date">
          <input type="date" className="input-field" value={form.ai_extracted.due_date} onChange={e => setExtracted('due_date', e.target.value)} />
        </Field>
        <Field label="Account #">
          <input className="input-field" value={form.ai_extracted.account_number} onChange={e => setExtracted('account_number', e.target.value)} />
        </Field>
        <Field label="Summary" className="md:col-span-2 lg:col-span-3">
          <input className="input-field" value={form.ai_extracted.summary} onChange={e => setExtracted('summary', e.target.value)} />
        </Field>
        <Field label="Notes" className="md:col-span-2 lg:col-span-3">
          <textarea className="input-field" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </Field>
        <div className="flex gap-3 md:col-span-2 lg:col-span-3">
          <Button type="submit">Confirm & Save</Button>
          <Button variant="ghost" type="button" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

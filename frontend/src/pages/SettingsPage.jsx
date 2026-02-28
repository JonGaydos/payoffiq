import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCurrency } from '../contexts/CurrencyContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import { API_BASE } from '../utils/api';
import { AI_PROVIDERS, CURRENCIES } from '../utils/constants';

export default function SettingsPage() {
  const { authFetch, setAutoLockMinutes } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const { currency, locale, setCurrency, setLocale } = useCurrency();

  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Password change
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // API key inputs
  const [keyInputs, setKeyInputs] = useState({});

  // Other settings
  const [paperlessUrl, setPaperlessUrl] = useState('');
  const [paperlessToken, setPaperlessToken] = useState('');
  const [homeboxUrl, setHomeboxUrl] = useState('');
  const [homeboxToken, setHomeboxToken] = useState('');
  const [autoLock, setAutoLock] = useState('');
  const [aiProvider, setAiProvider] = useState('claude');

  const loadSettings = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/settings`);
      const data = await res.json();
      setSettings(data);
      setPaperlessUrl(data.paperless_ngx_url || '');
      setPaperlessToken(data.paperless_ngx_token ? '••••••••' : '');
      setHomeboxUrl(data.homebox_url || '');
      setHomeboxToken(data.homebox_token ? '••••••••' : '');
      setAutoLock(data.auto_lock_minutes || '');
      setAiProvider(data.ai_provider || 'claude');

      const inputs = {};
      for (const p of AI_PROVIDERS) {
        inputs[p.keyField] = data[p.keyField] || '';
      }
      setKeyInputs(inputs);
    } catch {}
  }, [authFetch]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const saveSettings = async (obj) => {
    setSaving(true);
    setMessage('');
    try {
      await authFetch(`${API_BASE}/settings`, {
        method: 'POST',
        body: JSON.stringify(obj),
      });
      setMessage('Settings saved');
      await loadSettings();
      setTimeout(() => setMessage(''), 2000);
    } catch {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (id) => {
    setTheme(id);
    saveSettings({ theme: id });
  };

  const handleCurrencyChange = (code) => {
    setCurrency(code);
    saveSettings({ currency: code });
  };

  const handleAutoLockChange = (val) => {
    setAutoLock(val);
    const mins = parseInt(val, 10);
    if (mins > 0) {
      setAutoLockMinutes(mins);
      saveSettings({ auto_lock_minutes: val });
    } else if (val === '' || val === '0') {
      setAutoLockMinutes(null);
      saveSettings({ auto_lock_minutes: '' });
    }
  };

  const handleSaveApiKey = (keyField, value) => {
    if (value.includes('••••••••')) return;
    saveSettings({ [keyField]: value });
  };

  const handleDeleteApiKey = async (keyField) => {
    await authFetch(`${API_BASE}/settings/${keyField}`, { method: 'DELETE' });
    setKeyInputs(prev => ({ ...prev, [keyField]: '' }));
    await loadSettings();
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return; }
    try {
      const res = await authFetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPwSuccess('Password changed successfully');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err) {
      setPwError(err.message);
    }
  };

  const handleSavePaperless = () => {
    const obj = { paperless_ngx_url: paperlessUrl };
    if (!paperlessToken.includes('••••••••')) {
      obj.paperless_ngx_token = paperlessToken;
    }
    saveSettings(obj);
  };

  const handleSaveHomebox = () => {
    const obj = { homebox_url: homeboxUrl };
    if (!homeboxToken.includes('••••••••')) {
      obj.homebox_token = homeboxToken;
    }
    saveSettings(obj);
  };

  return (
    <div>
      <h1 className="font-serif text-2xl font-bold text-ink mb-6">Settings</h1>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">{message}</div>
      )}

      <div className="space-y-6">
        {/* Theme */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Appearance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={`p-3 rounded-lg text-left text-sm transition-all border ${
                  theme === t.id
                    ? 'border-gold bg-gold/10 ring-2 ring-gold/30'
                    : 'border-card-border hover:border-gold/50'
                }`}
              >
                <span className="text-lg mr-1">{t.emoji}</span>
                <span className="font-semibold">{t.label}</span>
                <p className="text-xs text-warm-gray mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Currency */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Currency & Locale</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Default Currency">
              <select
                className="input-field"
                value={currency}
                onChange={e => handleCurrencyChange(e.target.value)}
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.label} ({c.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Locale">
              <select
                className="input-field"
                value={locale}
                onChange={e => { setLocale(e.target.value); saveSettings({ locale: e.target.value }); }}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-CA">English (Canada)</option>
                <option value="fr-FR">French</option>
                <option value="de-DE">German</option>
                <option value="es-ES">Spanish</option>
                <option value="ja-JP">Japanese</option>
                <option value="pt-BR">Portuguese (Brazil)</option>
              </select>
            </Field>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Security</h2>

          <div className="mb-4">
            <Field label="Auto-Lock Timer (minutes)">
              <input
                type="number"
                className="input-field max-w-[200px]"
                value={autoLock}
                onChange={e => handleAutoLockChange(e.target.value)}
                placeholder="0 = disabled"
                min="0"
              />
            </Field>
            <p className="text-xs text-warm-gray mt-1">Auto-logout after inactivity. Set to 0 to disable.</p>
          </div>

          <hr className="border-card-border my-4" />

          <h3 className="font-semibold text-sm mb-3">Change Password</h3>
          {pwError && <div className="mb-3 p-2 rounded bg-danger/10 text-danger text-xs">{pwError}</div>}
          {pwSuccess && <div className="mb-3 p-2 rounded bg-success/10 text-success text-xs">{pwSuccess}</div>}
          <form onSubmit={handlePasswordChange} className="space-y-3 max-w-sm">
            <Field label="Current Password">
              <input type="password" className="input-field" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />
            </Field>
            <Field label="New Password">
              <input type="password" className="input-field" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={6} />
            </Field>
            <Field label="Confirm New Password">
              <input type="password" className="input-field" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required minLength={6} />
            </Field>
            <Button>Change Password</Button>
          </form>
        </Card>

        {/* AI Providers */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">AI Providers</h2>
          <div className="mb-4">
            <Field label="Default AI Provider">
              <select
                className="input-field max-w-xs"
                value={aiProvider}
                onChange={e => { setAiProvider(e.target.value); saveSettings({ ai_provider: e.target.value }); }}
              >
                {AI_PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="space-y-3">
            {AI_PROVIDERS.map(provider => (
              <div key={provider.value} className="flex items-end gap-2">
                <Field label={provider.label} className="flex-1">
                  <input
                    type="password"
                    className="input-field"
                    value={keyInputs[provider.keyField] || ''}
                    onChange={e => setKeyInputs(prev => ({ ...prev, [provider.keyField]: e.target.value }))}
                    placeholder={provider.value === 'ollama' ? 'http://host.docker.internal:11434' : `Enter ${provider.label} API key`}
                  />
                </Field>
                <Button
                  variant="sm"
                  className="btn-primary mb-0.5"
                  onClick={() => handleSaveApiKey(provider.keyField, keyInputs[provider.keyField])}
                >
                  Save
                </Button>
                {settings[`has_${provider.keyField}`] && (
                  <Button
                    variant="sm"
                    className="bg-danger text-white mb-0.5"
                    onClick={() => handleDeleteApiKey(provider.keyField)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Paperless-NGX */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">Paperless-NGX Integration</h2>
          <div className="space-y-3 max-w-lg">
            <Field label="Paperless-NGX URL">
              <input
                type="url"
                className="input-field"
                value={paperlessUrl}
                onChange={e => setPaperlessUrl(e.target.value)}
                placeholder="https://paperless.yourdomain.com"
              />
            </Field>
            <Field label="API Token">
              <input
                type="password"
                className="input-field"
                value={paperlessToken}
                onChange={e => setPaperlessToken(e.target.value)}
                placeholder="Enter Paperless-NGX API token"
              />
            </Field>
            <Button onClick={handleSavePaperless} disabled={saving}>
              Save Paperless Settings
            </Button>
          </div>
          {paperlessUrl && (
            <a
              href={paperlessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-gold hover:underline"
            >
              Open Paperless-NGX {'\u2197'}
            </a>
          )}
        </Card>

        {/* HomeBox */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-4">HomeBox Integration</h2>
          <p className="text-xs text-warm-gray mb-4">
            Connect to your HomeBox instance for home inventory and maintenance tracking.
          </p>
          <div className="space-y-3 max-w-lg">
            <Field label="HomeBox URL">
              <input
                type="url"
                className="input-field"
                value={homeboxUrl}
                onChange={e => setHomeboxUrl(e.target.value)}
                placeholder="https://homebox.yourdomain.com"
              />
            </Field>
            <Field label="API Token">
              <input
                type="password"
                className="input-field"
                value={homeboxToken}
                onChange={e => setHomeboxToken(e.target.value)}
                placeholder="Enter HomeBox API token"
              />
            </Field>
            <Button onClick={handleSaveHomebox} disabled={saving}>
              Save HomeBox Settings
            </Button>
          </div>
          {homeboxUrl && (
            <a
              href={homeboxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-gold hover:underline"
            >
              Open HomeBox {'\u2197'}
            </a>
          )}
        </Card>

        {/* About */}
        <Card>
          <h2 className="font-serif text-lg font-bold text-ink mb-2">About PayoffIQ</h2>
          <p className="text-sm text-warm-gray">Version 5.0.0</p>
          <p className="text-sm text-warm-gray mt-1">
            Self-hosted loan and household finance management.
          </p>
          <a
            href="https://github.com/JonGaydos/payoffiq"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-sm text-gold hover:underline"
          >
            View on GitHub {'\u2197'}
          </a>
        </Card>
      </div>
    </div>
  );
}

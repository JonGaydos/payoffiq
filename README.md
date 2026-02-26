# PayoffIQ 💰

A self-hosted loan and household finance manager. Track mortgages, auto loans, HELOC, ARM, and personal loans — plus household bills — with full AI-powered statement analysis and bank-accurate escrow tracking.

## Features

### 🏠 Loan Tracking
- Multiple loan types: Mortgage, ARM, HELOC, Auto, Personal
- Payment history with AI extraction (Claude, ChatGPT, Gemini, Copilot)
- Save PDF statements to Documents (with or without AI analysis)
- Principal, interest, escrow, and extra principal tracking
- Running balance and payoff projection

### 🧮 Payoff Calculator
- Extra monthly payment scenarios
- Lump sum payoff modeling
- Payoff-by-date calculator (up to 3 target dates)
- ARM rate scenario modeling (best/worst/current)
- Full amortization schedule viewer

### 🏛️ Escrow Tracker
- Bank-accurate running balance ledger (deposits from payments + disbursements)
- Balance vs. target progress bar
- Annual escrow statement processing (AI extraction or manual entry)
- Document attachment per disbursement (AI analysis or storage only)
- Adjustment history from annual statements

### 📁 Documents
- Upload PDFs and images to any loan, payment, or escrow item
- Cross-linked: documents show linked payment date with navigation button
- Payment history shows "→ View in Payments" link from Documents view

### 💡 Household Bills
- Customizable bill categories (Electric, Internet, Water, TV, Insurance, etc.)
- Quick presets with relevant tracking fields (kWh, GB, gallons, etc.)
- AI PDF extraction per bill type
- Analytics charts: payments over time + any custom field over time
- Per-bill document storage

### 🎨 Themes (7)
- ☀️ Light · 🌙 Dark · 🌊 Slate · 🟢 Green & Red · 🌌 Midnight · 🌲 Forest · 🐋 Ocean

### 🔑 Authentication & Security
- Single-user JWT authentication
- Password reset via local network token URL (no email required)
- All data stored locally in SQLite

---

## Unraid Setup

1. Install via **Community Applications** or manually add the container template
2. Set port to `3010` and data volume to `/mnt/user/appdata/payoffiq`
3. Access at `http://[server-ip]:3010`

### Force Update
After GitHub Actions builds a new image: Docker tab → PayoffIQ → **Force Update**

### Password Reset
```
http://[server-ip]:3010/api/auth/generate-reset-token
```
Copy the `reset_url` value and open it in your browser (valid 15 minutes).

---

## Docker (Self-hosted)

```yaml
version: '3'
services:
  payoffiq:
    image: ghcr.io/jongaydos/payoffiq:latest
    ports:
      - "3010:80"
    volumes:
      - ./data:/data
    restart: unless-stopped
```

---

## AI Provider Setup

Go to **Settings** → API Keys. Supported providers:
- **Claude** (Anthropic) — [console.anthropic.com/api-keys](https://console.anthropic.com/api-keys)
- **ChatGPT** (OpenAI) — [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Gemini** (Google) — [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- **Copilot** (Microsoft) — GitHub PAT with `models:read` scope

---

## Help & Support

- [GitHub Issues & Discussions](https://github.com/JonGaydos/payoffiq)
- Feature requests welcome!

---

## Architecture

Single Docker container:
- **nginx** — serves React frontend
- **Node.js** — Express API backend
- **SQLite** — local database (`/data/payoffiq.db`)
- **supervisord** — process manager

Data persists in `/data` volume. No cloud dependencies.

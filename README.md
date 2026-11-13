# Pocketpals

Pocketpals is a kawaii personal finance tracker for organizing bank statements, transactions, wallets, and monthly cash flow.

## Features

- Clerk authentication with Google sign-in
- MySQL persistence through Cloudflare Hyperdrive
- Statement imports for DBS, BCA, and BCA credit cards
- CSV, XLS, XLSX, and text-based PDF parsing
- Personal and Business financial spaces
- Wallet balances and bank mutation history
- Inline transaction editing, category autocomplete, remarks, search, and filters
- Auto Tagging rules
- Indonesian and English UI
- Theme and avatar selection

## Requirements

- Node.js `>=22.13.0`
- Access to the configured MySQL database for authenticated development
- Clerk environment variables for local authentication

## Local setup

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Set local-only values in `.env.local`. Never commit `.env.local`, production credentials, or real bank statements.

Useful checks:

```bash
npm run lint
npm run build
```

## Project structure

- `app/` — UI, authentication pages, and API routes
- `lib/` — statement parsing and shared utilities
- `db/` — MySQL schema and database helpers
- `public/` — static avatars and application assets
- `build/` — vendored Sites build plugin required by `vite.config.ts`
- `.openai/hosting.json` — Sites hosting configuration

## Synthetic test data

Tests and reviewer fixtures should use fictional transactions only. Do not add real account numbers, names, emails, bank statements, screenshots, or credentials to the repository.

## License

MIT. See `LICENSE`.

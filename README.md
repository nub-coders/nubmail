# NubMail

A lightweight email management system built with Next.js 15 and PostgreSQL. Features:

- Manage custom domains and verify DNS records
- Create email accounts per domain
- Send emails via built-in or custom SMTP
- Receive inbound emails via a simple SMTP receiver

## Getting Started

### Option 1: Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see below)

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:5000](http://localhost:5000) in your browser

### Option 2: Docker (Development)

1. Make sure you have Docker and Docker Compose installed

2. Create a `.env` file with your environment variables

3. Start the services:

One-shot bring-up (DB + dev app + SMTP services):
```bash
docker compose up -d postgres app-dev smtp-sender smtp-receiver
```
Stop services:
```bash
docker compose down
```

## Environment Variables

Create a `.env` file with the following (add new Outlook integration vars if using external mailbox sync):

```
# App
JWT_SECRET=your_jwt_secret

# Database (PostgreSQL)
USE_POSTGRES=true
POSTGRES_URL=postgres://nubmail:nubmail@localhost:5432/nubmail

# SMTP (optional overrides; defaults provided for internal sender)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password

# Optional app domain config
DOMAIN=mails.nubcoder.com
PROTOCOL=https

# Outlook / Microsoft Graph (optional)
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_OUTLOOK_REDIRECT_URI=https://your-host/api/integrations/outlook/callback
TOKEN_ENCRYPTION_KEY=change_this_32_char_secret

# Admin bootstrap (if applicable to your setup)
ADMIN_PASS=your_admin_password
ADMIN_EMAIL=
```

## Features

- User authentication with JWT
- Domain management and verification
- Email account creation and management
- Message composition and inbox
- Receive inbound emails (SMTP receiver)
- Modern UI with shadcn/ui components
- (Optional) External mailbox integration scaffolding (Outlook via Microsoft Graph OAuth + delta sync stub)
- API key based programmatic sending (create keys, use `X-Api-Key` header)

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL
- **Authentication**: JWT with bcryptjs
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **AI**: Genkit with Google Gemini

## Docker Configuration

The application includes a Docker Compose setup with the following services:

- **PostgreSQL**: Persistent database with initialization from `docs/postgres-schema.sql`
- **App (Production)**: Optimized Next.js build running on port 5000
- **SMTP Sender**: Outbound SMTP relay (boky/postfix) on ports 465/587
- **SMTP Receiver**: Inbound SMTP server (Node.js) on port 25
- **Dovecot**: IMAP/POP3 server with wildcard SSL

### Docker Services

| Service | Container | Ports | Description |
|---------|-----------|-------|-------------|
| `postgres` | nubmail-postgres-1 | 5432 | PostgreSQL 16 with persistent volumes |
| `app` | nubmail-app | 5000 (internal) | Production Next.js app |
| `smtp-sender` | nubmail-smtp-sender | 587 | Outbound SMTP relay |
| `smtp-receiver` | nubmail-smtp-receiver | 25 | Inbound SMTP receiver (stores into Postgres) |
| `dovecot` | nubmail-dovecot | 143, 993, 110, 995 | IMAP/POP3 server with SSL |

### nginx-proxy Integration

The production app is configured to work with [jwilder/nginx-proxy](https://github.com/nginx-proxy/nginx-proxy):
- Virtual Host: `mails.nubcoder.com`
- Virtual Port: `5000`
- Let's Encrypt Host: `*.nubcoder.com` (wildcard via DNS-01 challenge)
- Let's Encrypt Email: `dev@nubcoder.com`

Make sure nginx-proxy and acme-companion are running on the `web` network.

### Wildcard SSL (*.nubcoder.com)

A wildcard SSL certificate is issued via `nginxproxy/acme-companion` using Cloudflare DNS-01 challenge. The acme-companion container requires:

```yaml
environment:
  - ACME_CHALLENGE=DNS-01
  - ACMESH_DNS_API_CONFIG={"DNS_API":"dns_cf","CF_Key":"...","CF_Email":"..."}
```

The wildcard cert is stored at `/root/nginx-proxy/nginx/certs/wildcard_nubcoder.com/` and is copied into `./dovecot/ssl/` as `tls.crt` and `tls.key` for dovecot to use.

A cron job runs daily at 3 AM to sync renewed certs:
```bash
# Installed in crontab
0 3 * * * /root/nubmail/scripts/renew-dovecot-cert.sh
```

The script (`scripts/renew-dovecot-cert.sh`) diffs the cert, copies only if changed, and restarts dovecot automatically.

### Email Client Settings

| Protocol | Hostname | Port | Security |
|----------|----------|------|----------|
| IMAP | `imap.nubcoder.com` | 993 | SSL/TLS |
| SMTP | `smtp.nubcoder.com` | 587 | STARTTLS |
| POP3 | `pop3.nubcoder.com` | 995 | SSL/TLS |
| Webmail | `mails.nubcoder.com` | 443 | HTTPS |

## Project Structure

- `/src/app` - Next.js pages and API routes
- `/src/components` - Reusable React components
- `/src/lib` - Utility functions and shared logic
- `Dockerfile` - Multi-stage Docker build configuration
- `docker-compose.yml` - Docker Compose orchestration

## API Key Email Sending

Workflow:
1. Login and obtain JWT.
2. `POST /api/auth/api-keys` with `{ "name": "prod" }` to create a key (store returned `key` once).
3. Create or ensure an email account exists for the desired `from` address.
4. Send mail with API key:
```bash
curl -X POST https://your-host/api/emails/send-api \
	-H "X-Api-Key: nm_live_abcdef..." \
	-H "Content-Type: application/json" \
	-d '{
		"from":"support@yourdomain.com",
		"to":"user@example.com",
		"subject":"Test",
		"text":"Hello via key"
	}'
```
Response:
```json
{ "message": "Email sent", "messageId": "<id>", "accepted": ["user@example.com"], "rejected": [] }
```
Notes:
- API key authenticates only; sender must be an owned account.
- Built-in SMTP is used if the account `use_built_in_smtp` is true; otherwise custom credentials.
- DKIM auto-generation occurs on first send if domain present.

### Docker: PostgreSQL

Environment (shell):

```bash
export USE_POSTGRES=true
export POSTGRES_URL=postgres://nubmail:nubmail@localhost:5432/nubmail
export JWT_SECRET=replace-with-a-strong-secret
```

Apply schema manually (optional; compose auto-loads `docs/postgres-schema.sql` on first run):

```bash
docker exec -i $(docker ps -qf name=nubmail-postgres-1) psql -U nubmail -d nubmail < docs/postgres-schema.sql
```

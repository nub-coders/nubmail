# [NubMail](https://mails.nubcoders.com)

[![License](https://img.shields.io/github/license/nub-coders/nubmail?color=0f766e)](LICENSE)
[![Issues](https://img.shields.io/github/issues/nub-coders/nubmail?color=0f766e)](https://github.com/nub-coders/nubmail/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/nub-coders/nubmail?color=0f766e)](https://github.com/nub-coders/nubmail/pulls)

[**NubMail**](https://mails.nubcoders.com) is a powerful, self-hosted email management system built with **Next.js**, **React 19**, and **PostgreSQL**. Designed for developers and organizations that need full control over their email infrastructure — from sending and receiving mail to managing domains, teams, and API keys.

## Key Features

- 🌐 **Domain Management** – Add custom domains and verify DNS records (SPF, DKIM, MX)
- 📧 **Email Accounts** – Create and manage unlimited email accounts per domain
- 📤 **Email Sending** – Send via built-in Postfix relay or custom SMTP providers, with automatic DKIM signing
- 📨 **Email Receiving** – Receive inbound emails via a Node.js SMTP listener (`smtp-server`)
- 👥 **Teams** – Collaborative team management and shared mailbox access
- 🔔 **Push Notifications** – Web push alerts for new mail (VAPID-based, opt-in)
- 🔐 **Security** – JWT authentication, encrypted API keys, DKIM signing, field-level encryption
- 🎨 **Modern UI** – Responsive dark/light interface built with shadcn/ui and Tailwind CSS
- 📱 **Multi-Protocol** – IMAP, POP3, and SMTP support with SSL/TLS encryption
- 💾 **Automated Backups** – Nightly encrypted database backups to Backblaze B2 and Cloudflare R2

## Open Source

NubMail is released under the [MIT License](LICENSE). Contributions are welcome — see the [Contributing](#contributing) section below.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (local or Docker)
- Docker & Docker Compose (optional, recommended)

### Option 1: Local Development

```bash
# 1. Clone and install dependencies
git clone https://github.com/nub-coders/nubmail.git
cd nubmail
npm install

# 2. Set up environment variables
cp .env.example .env   # fill in the required values

# 3. Run the development server
npm run dev

# 4. Open http://localhost:5000
```

### Option 2: Docker Setup (Recommended)

```bash
# 1. Create environment configuration
cp .env.example .env   # fill in the required values

# 2. Build and start all services
docker compose up -d --build

# 3. Open http://localhost:5000

# To stop services
docker compose down
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and replace all placeholder values. Never commit `.env` to version control.

Generate strong secrets with:
```bash
openssl rand -base64 32
```

#### Required for all environments

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Signs session JWTs |
| `API_KEY_ENCRYPTION_SECRET` | Encrypts stored API keys (AES-256-GCM) |
| `FIELD_ENCRYPTION_SECRET` | Encrypts sensitive DB fields (e.g. DKIM private keys) |
| `POSTGRES_URL` | PostgreSQL connection string |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASS` | Initial admin account password |

#### Required for production

| Variable | Description |
|----------|-------------|
| `DOMAIN` | Apex domain this server sends mail for |
| `HOST` | Public hostname of the mail server (A record + TLS cert CN) |
| `PROTOCOL` | `http` or `https` |
| `NEXT_PUBLIC_SITE_URL` | Public base URL of the web app |
| `SMTP_HOST` | Outbound SMTP relay host |
| `SMTP_PORT` | Outbound SMTP relay port (typically `587`) |
| `SMTP_USER` | Outbound SMTP username |
| `SMTP_PASS` | Outbound SMTP password |

#### Optional

| Variable | Description |
|----------|-------------|
| `BACKUP_ENCRYPTION_KEY` | Encrypts nightly database backups |
| `VAPID_PUBLIC_KEY` | Web push public key (enable push notifications) |
| `VAPID_PRIVATE_KEY` | Web push private key |
| `VAPID_SUBJECT` | Web push contact (e.g. `mailto:admin@example.com`) |
| `CERTS_DIR` | Base path for Let's Encrypt certs (default: `./certs`) |
| `NGINX_CERTS_DIR` | Override if certs are managed by an external reverse proxy (e.g. nginx-proxy) |
| `BIMI_LOGO_URL` | HTTPS URL of the BIMI brand logo (default: `https://<HOST>/logo.svg`) |

## Features

### Core Capabilities
- ✅ User authentication with JWT tokens and secure session management
- ✅ Domain management with DNS verification (SPF, MX, DKIM)
- ✅ Email account creation and administration
- ✅ Compose, send, and reply to emails
- ✅ Full inbox, sent, archive, drafts, spam, and trash management
- ✅ Receive inbound emails via built-in SMTP listener
- ✅ IMAP/POP3 support for standard email clients (via Dovecot)

### Developer Features
- ✅ RESTful API with API key authentication
- ✅ Programmatic email sending via API
- ✅ DKIM automatic signing and verification per domain
- ✅ Admin dashboard and server DNS management
- ✅ User, domain, team, and account administration panels
- ✅ Developer settings and API key management UI

### Security & Integration
- ✅ JWT-based session management
- ✅ bcryptjs password hashing
- ✅ AES-256-GCM field-level encryption for sensitive data
- ✅ Rate limiting on API routes
- ✅ HTML email sanitization (sanitize-html)
- ✅ Optional Microsoft Graph / Outlook integration
- ✅ SSL/TLS encryption for all protocols
- ✅ Per-host Let's Encrypt cert (auto-managed by Traefik + traefik-certs-dumper)

### Additional Features
- ✅ Web push notifications for new mail (VAPID)
- ✅ Team collaboration and shared mailbox access
- ✅ Email drafts with auto-save
- ✅ Bulk email actions (mark read/unread, archive, delete)
- ✅ Forgot password / reset password flow
- ✅ Email verification on registration
- ✅ Nightly encrypted database backups to B2 + R2

## Technology Stack

### Frontend
- **Next.js** – React framework with TypeScript (App Router)
- **React 19** – UI library
- **Tailwind CSS v4** – Utility-first styling
- **shadcn/ui** – Component library (Radix UI + Tailwind)
- **react-hook-form + Zod** – Form handling and validation

### Backend
- **Next.js API Routes** – Serverless-style route handlers
- **PostgreSQL** – Relational database
- **JWT (jsonwebtoken)** – Token-based authentication
- **bcryptjs** – Password hashing
- **nodemailer** – Email composition and sending

### Email Infrastructure
- **Postfix** – Outbound SMTP relay
- **Dovecot** – IMAP/POP3 server for email clients
- **smtp-server** – Node.js inbound SMTP listener for receiving mail
- **mailparser** – Parsing raw inbound email messages

### Additional Services
- **Docker & Docker Compose** – Containerization and orchestration
- **Traefik + traefik-certs-dumper** – Reverse proxy with automatic Let's Encrypt TLS
- **web-push** – VAPID-based web push notifications
- **rclone + pg_dump** – Encrypted nightly backups to B2/R2

## Docker Setup

### Services Overview

| Service | Image | Port(s) | Purpose |
|---------|-------|---------|---------|
| **postgres** | postgres:16 | 5432 | Database with auto-initialization |
| **app** | nubmail (custom) | 5000 | Next.js application |
| **smtp-sender** | boky/postfix | 587, 465 | Outbound SMTP relay |
| **smtp-receiver** | node:22 | 25 | Inbound SMTP (smtp-server) |
| **dovecot** | Custom | 143, 993, 110, 995 | IMAP/POP3 server |

### Starting Services

```bash
# Build and start all services
docker compose up -d --build

# Start specific services only
docker compose up -d postgres app smtp-sender smtp-receiver

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Clean up volumes (use with caution — deletes all data)
docker compose down -v
```

### Database Initialization

The PostgreSQL container automatically loads the schema from `docs/postgres-schema.sql` on first run. To manually apply the schema:

```bash
docker exec -i $(docker ps -qf name=postgres) \
  psql -U nubmail -d nubmail < docs/postgres-schema.sql
```

To seed the initial admin user:
```bash
node scripts/init-admin.js
```

### Production Deployment

#### With Traefik

The application integrates with [Traefik](https://traefik.io/) for:
- Automatic reverse proxy configuration
- SSL/TLS termination via Let's Encrypt
- Virtual host routing

**Configuration:**

Traefik labels are pre-configured on the `app` service in `docker-compose.yml`. You need to set the `HOST` environment variable in your `.env` file to your desired domain:

```env
HOST=mail.example.com
```

**Setup:**

1. Ensure the external Docker network `web` exists (which Traefik and the application use to communicate):
   ```bash
   docker network create web
   ```

2. Ensure the external volume `halvo_traefik_acme` is created or mapped to Traefik's `acme.json` location:
   ```bash
   docker volume create halvo_traefik_acme
   ```

3. Spin up the containers:
   ```bash
   docker compose up -d
   ```

#### Mail TLS Certificate

Dovecot (IMAP/POP3) and Postfix (SMTP) share the same per-host Let's Encrypt certificate that Traefik issues for the web application. The `traefik-certs-dumper` service automatically extracts and dumps the certificates from Traefik's `acme.json` into the `./certs` folder.

By default the bind-mount resolves to `./certs/${HOST}`.
Override the base path or hostname via env vars in `.env`:

```bash
CERTS_DIR=./certs              # default cert base directory
HOST=mail.example.com          # your mail server hostname
# Override if using a custom path:
# NGINX_CERTS_DIR=/path/to/certs
```

**Certificate Renewal:**
When Traefik renews the certificate, `traefik-certs-dumper` detects the change in `acme.json`, dumps the updated certificate/key to `./certs`, and triggers a post-hook that restarts the mail services (`smtp-sender`, `dovecot`, `smtp-receiver`) automatically via the Docker socket. No daily cron reload script is required when running under this setup.

### Email Client Configuration

Connect standard email clients using these settings:

| Protocol | Server | Port | Security |
|----------|--------|------|----------|
| **SMTP** | mail.example.com | 587 | STARTTLS |
| **IMAP** | mail.example.com | 993 | SSL/TLS |
| **POP3** | mail.example.com | 995 | SSL/TLS |
| **Webmail** | mails.example.com | 443 | HTTPS |

#### Example: Thunderbird Setup
1. Email: `user@example.com`
2. Password: `your-email-password`
3. IMAP: `mail.example.com:993` (SSL)
4. SMTP: `mail.example.com:587` (STARTTLS)

### BIMI Brand Logo (Optional)

BIMI (Brand Indicators for Message Identification) displays your brand logo next
to your messages in supporting inboxes. It is **purely cosmetic and has no effect
on deliverability** — treat it as a nice-to-have. The server DNS dashboard lists
the BIMI record as an optional check.

**Prerequisites**
- DMARC published with `p=quarantine` or `p=reject` (already recommended above).
- A logo in **SVG Tiny 1.2 Portable/Secure (SVG P/S)** format served over HTTPS.
  A ready-made file ships at [`public/logo.svg`](public/logo.svg), served at
  `https://<HOST>/logo.svg`. **Replace it with your own logo** before publishing.

**SVG format requirements** — a normal SVG export will *not* validate. The file must:
- Use `<svg version="1.2" baseProfile="tiny-ps" ...>` with a square `viewBox`.
- Contain a `<title>` element (your brand name) as the first child of `<svg>`.
- Omit `<script>`, `<defs>`, `clipPath`/`clip-path`, external references, and
  `xlink:href`. Bake any circular crop into the shapes instead of clipping.
- Stay under 32 KB.

Validate the file at [bimigroup.org](https://bimigroup.org/bimi-generator/) before
publishing DNS.

**DNS record** (on the apex domain that appears after the `@` in your addresses):

```
default._bimi.example.com  TXT  "v=BIMI1; l=https://mail.example.com/logo.svg; a="
```

Point `l=` at your own logo URL, or set `BIMI_LOGO_URL` to override the default.
The `a=` tag is for a paid Verified Mark Certificate (VMC) — Gmail and Apple Mail
only render the logo when a valid VMC is present; other clients show it without one.

## Project Structure

```
nubmail/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── api/               # API endpoints
│   │   │   ├── accounts/      # Email account management
│   │   │   ├── admin/         # Admin-only routes (server DNS, users)
│   │   │   ├── auth/          # Auth routes (login, register, API keys)
│   │   │   ├── domains/       # Domain management
│   │   │   ├── drafts/        # Email draft CRUD
│   │   │   ├── emails/        # Email send/receive/manage
│   │   │   ├── health/        # Health check endpoint
│   │   │   ├── profile/       # User profile management
│   │   │   ├── push/          # Web push subscription management
│   │   │   ├── stats/         # Mailbox statistics
│   │   │   └── teams/         # Team management
│   │   ├── dashboard/         # Authenticated app pages
│   │   │   ├── accounts/      # Email account management
│   │   │   ├── admin/         # Admin dashboard
│   │   │   ├── archive/       # Archived emails
│   │   │   ├── billing/       # Billing & plan management
│   │   │   ├── compose/       # Email composer
│   │   │   ├── developer/     # API keys & developer settings
│   │   │   ├── domains/       # Domain & DNS management
│   │   │   ├── drafts/        # Saved drafts
│   │   │   ├── inbox/         # Main inbox
│   │   │   ├── profile/       # User profile
│   │   │   ├── sent/          # Sent emails
│   │   │   ├── settings/      # App settings
│   │   │   ├── spam/          # Spam folder
│   │   │   ├── teams/         # Team management
│   │   │   └── trash/         # Deleted emails
│   │   ├── login/             # Login page
│   │   ├── register/          # Registration page
│   │   ├── forgot-password/   # Password recovery
│   │   ├── reset-password/    # Password reset
│   │   ├── verify-email/      # Email verification
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Landing / home page
│   ├── components/            # Reusable React components
│   │   ├── ui/               # shadcn/ui components
│   │   ├── main-nav.tsx       # Sidebar navigation
│   │   ├── user-nav.tsx       # User avatar/menu
│   │   ├── bulk-action-bar.tsx # Bulk email selection toolbar
│   │   ├── email-body-frame.tsx # Sandboxed email body renderer
│   │   ├── push-registration.tsx # Web push opt-in
│   │   └── auth-guard.tsx     # Route authentication guard
│   ├── lib/                   # Shared utilities & server-side logic
│   │   ├── auth-provider.tsx  # Client-side auth context
│   │   ├── auth-token.ts      # JWT helpers
│   │   ├── jwt-server.ts      # Server-side JWT verification
│   │   ├── api-keys.ts        # API key generation & encryption
│   │   ├── field-encryption.ts # AES-256-GCM field encryption
│   │   ├── push-notifications.ts # Web push helpers
│   │   ├── bulk-email-actions.ts # Shared bulk action logic
│   │   ├── email-body.ts      # Email body parsing/sanitization
│   │   ├── rate-limit.ts      # In-memory rate limiter
│   │   ├── postgres.ts        # PostgreSQL connection pool
│   │   ├── admin.ts           # Admin privilege helpers
│   │   ├── types.ts           # Shared TypeScript types
│   │   └── utils.ts           # General utilities
│   ├── hooks/                 # Custom React hooks
│   ├── utils/                 # Additional utility modules
│   └── proxy.ts               # Proxy configuration
├── smtp/
│   └── index.js               # Node.js inbound SMTP receiver (smtp-server)
├── dovecot/                   # Dovecot IMAP/POP3 configuration
├── docs/                      # Documentation & SQL schemas
│   └── postgres-schema.sql    # Database schema (auto-loaded on first run)
├── scripts/
│   ├── backup-pg.sh           # Nightly encrypted DB backup to B2/R2
│   ├── restore-pg.sh          # Restore DB from backup
│   ├── reload-mail-certs.sh   # Reload Dovecot/Postfix after cert renewal
│   └── init-admin.js          # Seed initial admin user
├── certs/                     # TLS certificates (bind-mounted into containers)
├── Dockerfile                 # Multi-stage Docker build
├── docker-compose.yml         # Compose orchestration
├── DNS_SETUP_GUIDE.md         # DNS records setup guide
├── SMTP_SETUP_GUIDE.md        # SMTP configuration guide
└── IMAP_POP3_SETUP_GUIDE.md   # IMAP/POP3 setup guide
```

## API Reference

### Authentication

All API endpoints require either:
- **Bearer token** – `Authorization: Bearer <jwt_token>` (for user-facing routes)
- **API key** – `X-Api-Key: <api_key>` (for programmatic access)

### Sending Email with API Keys

Use API keys to programmatically send emails from your application.

#### Step 1: Create an Email Account

```bash
POST /api/accounts
Authorization: Bearer $JWT_TOKEN
Content-Type: application/json

{
  "email": "support@example.com",
  "domain_id": 1
}
```

#### Step 2: Create an API Key

```bash
POST /api/auth/api-keys
Authorization: Bearer $JWT_TOKEN
Content-Type: application/json

{
  "name": "Production Sender"
}
```

Response:
```json
{
  "key": "nm_live_abc123def456...",
  "name": "Production Sender",
  "created_at": "2025-04-28T10:00:00Z"
}
```

> ⚠️ **Important:** Store the API key securely. It is shown once in plaintext — afterwards only the encrypted copy is stored.

#### Step 3: Send Email

```bash
curl -X POST https://mails.example.com/api/emails/send-api \
  -H "X-Api-Key: nm_live_abc123def456..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": "support@example.com",
    "to": "user@example.com",
    "subject": "Hello from NubMail",
    "text": "This is a text email",
    "html": "<h1>This is an HTML email</h1>"
  }'
```

Response (Success):
```json
{
  "message": "Email sent successfully",
  "messageId": "<abc123@example.com>",
  "accepted": ["user@example.com"],
  "rejected": []
}
```

Response (Error):
```json
{
  "error": "Invalid API key"
}
```

#### API Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | ✅ | Sender email (must be an owned account) |
| `to` | string | ✅ | Recipient email |
| `cc` | string | ❌ | Carbon copy recipient(s) |
| `bcc` | string | ❌ | Blind carbon copy recipient(s) |
| `subject` | string | ✅ | Email subject |
| `text` | string | ❌ | Plain text body |
| `html` | string | ❌ | HTML body |

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Login and receive a JWT |
| `POST` | `/api/auth/register` | Register a new user |
| `GET/POST` | `/api/auth/api-keys` | List or create API keys |
| `GET/POST` | `/api/accounts` | List or create email accounts |
| `GET/POST` | `/api/domains` | List or add domains |
| `GET/POST` | `/api/emails` | List or send emails |
| `POST` | `/api/emails/send-api` | Send email via API key |
| `GET/POST` | `/api/drafts` | List or save drafts |
| `GET/POST` | `/api/teams` | List or manage teams |
| `GET/PUT` | `/api/profile` | Get or update user profile |
| `GET` | `/api/stats` | Mailbox statistics |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/admin/server-dns` | Admin: check server DNS records |

#### DKIM Signing

- DKIM signatures are **automatically generated** on the first send per domain
- Requires valid MX/SPF/DKIM DNS records
- Private keys are encrypted and stored in the database

#### Using a Custom SMTP Provider

Configure per-account custom SMTP credentials:
```bash
POST /api/accounts/{accountId}/smtp-config
Authorization: Bearer $JWT_TOKEN

{
  "use_built_in_smtp": false,
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_user": "your-email@gmail.com",
  "smtp_pass": "your-app-password"
}
```

## Development

### Build Commands

```bash
# Development server with hot reload (Turbopack)
npm run dev

# Type-check without emitting
npm run typecheck

# Lint code
npm run lint

# Production build
npm run build

# Start production server
npm start
```

### Database Schema

The PostgreSQL container initializes the schema automatically on first boot from `docs/postgres-schema.sql`. No manual migration scripts are required for a fresh local setup.

## Troubleshooting

### Common Issues

#### Emails not sending
- **Verify DKIM records:** Check DNS for `default._domainkey.example.com`
- **Check SMTP settings:** Verify `SMTP_HOST`, `SMTP_PORT`, and credentials in `.env`
- **Review logs:** `docker compose logs smtp-sender`

#### Cannot receive emails
- **Check MX records:** Verify DNS MX records point to your server
- **Verify SMTP receiver:** `docker compose logs smtp-receiver`
- **Check firewall:** Ensure port 25 is open and not blocked by your host/ISP

#### Server DNS dashboard shows records as "Missing" that actually exist
The admin **Server DNS** page checks records by resolving them from the host. If
the host's DNS resolver is slow or rate-limited (a common issue when
`/etc/resolv.conf` points at a single upstream such as `8.8.8.8`), lookups time
out and correctly-configured records get reported incorrectly.

The `/api/admin/server-dns` route mitigates this in two ways:
- It uses an explicit resolver with **redundant upstream servers**
  (`1.1.1.1`, `8.8.8.8`, `9.9.9.9`, `8.8.4.4`) and **retries** transient
  failures, rather than relying on the host `resolv.conf`.
- A lookup that times out or fails is now shown as a distinct **"Check failed"**
  status (not "Missing"), so a transient DNS blip no longer implies your records
  are broken. Use **Refresh status** to re-check.

If you still see intermittent "Check failed", fix the host resolver:
```bash
# Back up first
cp -a /etc/resolv.conf /etc/resolv.conf.bak

# Use redundant resolvers with fast failover
cat > /etc/resolv.conf <<'EOF'
nameserver 1.1.1.1
nameserver 9.9.9.9
nameserver 8.8.8.8
nameserver 8.8.4.4
options timeout:2 attempts:2 rotate
EOF

# If resolvconf is installed, seed it so the change survives regeneration
mkdir -p /etc/resolvconf/resolv.conf.d
cp /etc/resolv.conf /etc/resolvconf/resolv.conf.d/head
```

#### Database connection errors
- **Verify POSTGRES_URL:** Check environment variable is set correctly
- **Check database status:** `docker compose logs postgres`
- **Reset database:** `docker compose down -v && docker compose up -d postgres`

#### SSL/TLS certificate issues
- **Renew certificates:** Follow your deployment's certificate renewal process
- **Check certificate validity:** `openssl x509 -in ${CERTS_DIR:-./certs}/${HOST}/fullchain.pem -text`
- **Update LETSENCRYPT_EMAIL:** Ensure it's a valid email for renewal notifications

### Debugging

Enable debug logging:
```bash
# View application logs
docker compose logs -f app

# View SMTP receiver logs
docker compose logs -f smtp-receiver

# View Dovecot logs
docker compose logs -f dovecot

# View all service logs
docker compose logs -f
```

## Backups

### Automatic Daily Backups

Database backups run nightly via cron. The pipeline: `pg_dump → gzip → AES-256 encrypt → upload to B2 + R2`.

**Setup:**
```bash
# Add to crontab
30 2 * * * /root/nubmail/scripts/backup-pg.sh >> /var/log/nubmail-backup.log 2>&1
```

Requires `BACKUP_ENCRYPTION_KEY` in `.env` and `rclone` configured with `b2:` and `r2:` remotes.

Backups are stored at `b2:nubs-backups-b2/nubmail/daily/` with 30-day retention.

### Manual Backup

```bash
bash scripts/backup-pg.sh
```

### Restore

```bash
# Restore latest backup
bash scripts/restore-pg.sh

# Restore a specific backup
bash scripts/restore-pg.sh nubmail-pg-20260702_033208
```

You will be prompted to confirm before any data is overwritten.

## VPS Migration

1. **On the new VPS — install dependencies**
   ```bash
   apt update && apt install -y docker.io docker-compose rclone
   ```

2. **Clone the repo**
   ```bash
   git clone https://github.com/nub-coders/nubmail.git /root/nubmail
   ```

3. **Copy config from old VPS**
   - `.env` — `scp root@old-vps:/root/nubmail/.env /root/nubmail/.env`
   - rclone config — `scp root@old-vps:$(rclone config file | tail -1) $(rclone config file | tail -1)`

4. **Start Postgres and restore the database**
   ```bash
   docker compose up -d postgres
   bash scripts/restore-pg.sh
   ```

5. **Start all services**
   ```bash
   docker compose up -d --build
   ```

6. **Update DNS** — point your domain's A/MX records to the new VPS IP

7. **Set up cron jobs**
   ```bash
   (crontab -l 2>/dev/null; echo "30 2 * * * /root/nubmail/scripts/backup-pg.sh >> /var/log/nubmail-backup.log 2>&1"; echo "0 3 * * * /root/nubmail/scripts/reload-mail-certs.sh >> /var/log/nubmail-cert-reload.log 2>&1") | crontab -
   ```

8. **Verify** — test login, send/receive a test email, confirm backups run

## Support & Documentation

- **Issues & Bugs:** [GitHub Issues](https://github.com/nub-coders/nubmail/issues)
- **DNS Setup:** [`DNS_SETUP_GUIDE.md`](DNS_SETUP_GUIDE.md)
- **SMTP Configuration:** [`SMTP_SETUP_GUIDE.md`](SMTP_SETUP_GUIDE.md)
- **IMAP/POP3 Setup:** [`IMAP_POP3_SETUP_GUIDE.md`](IMAP_POP3_SETUP_GUIDE.md)
- **Database Schema:** [`docs/postgres-schema.sql`](docs/postgres-schema.sql)

## License

Released under the [MIT License](LICENSE).

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Made with ❤️ by NubMail Team**

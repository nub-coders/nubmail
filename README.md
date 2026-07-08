# [NubMail](https://mails.nubcoders.com)

[![License](https://img.shields.io/github/license/nub-coders/nubmail?color=0f766e)](LICENSE)
[![Issues](https://img.shields.io/github/issues/nub-coders/nubmail?color=0f766e)](https://github.com/nub-coders/nubmail/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/nub-coders/nubmail?color=0f766e)](https://github.com/nub-coders/nubmail/pulls)

[**NubMail**](https://mails.nubcoders.com) is a powerful, lightweight email management system built with **Next.js 16**, **React 19**, and **PostgreSQL**. Designed for developers and organizations that need full control over their email infrastructure.

## Key Features

- 🌐 **Domain Management** – Add custom domains and verify DNS records
- 📧 **Email Accounts** – Create and manage unlimited email accounts per domain
- 📤 **Email Sending** – Send emails via built-in SMTP relay or custom providers
- 📨 **Email Receiving** – Receive inbound emails with automatic storage
- 🔐 **Security** – JWT authentication, API keys, DKIM signing
- 🎨 **Modern UI** – Responsive interface built with shadcn/ui and Tailwind CSS
- 📱 **Multi-Protocol** – IMAP, POP3, SMTP support with SSL/TLS encryption

## Open Source

NubMail is released under the MIT License. See [LICENSE](LICENSE), [CONTRIBUTING.md](CONTRIBUTING.md), and [SECURITY.md](SECURITY.md) for the project rules and reporting process.

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (local or Docker)
- Docker & Docker Compose (optional, recommended)

### Option 1: Local Development

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd nubmail
npm install

# 2. Set up environment variables (see below)
cp .env.example .env  # or .env.local for local development

# 3. Run the development server
npm run dev

# 4. Open http://localhost:5000
```

### Option 2: Docker Setup (Recommended)

```bash
# 1. Create environment configuration
cp .env.example .env

# 2. Start all services
docker compose up -d --build

# 3. Open http://localhost:5000

# To stop services
docker compose down
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` or `.env.local` and replace the placeholder values. The template includes the required app, database, SMTP, backup, and push-notification settings used by the codebase and Docker setup.

For local development, the most important values are `JWT_SECRET`, `API_KEY_ENCRYPTION_SECRET`, `FIELD_ENCRYPTION_SECRET`, `POSTGRES_URL`, `ADMIN_EMAIL`, and `ADMIN_PASS`. For production deployments, also set `DOMAIN`, `HOST`, `PROTOCOL`, `SMTP_HOSTNAME`, `SMTP_BANNER_HOST`, and the optional `BACKUP_ENCRYPTION_KEY`.

## Features

### Core Capabilities
- ✅ User authentication with JWT tokens
- ✅ Domain management with DNS verification
- ✅ Email account creation and administration
- ✅ Compose and send emails
- ✅ Full inbox, archive, spam, and trash management
- ✅ Receive inbound emails via SMTP
- ✅ IMAP/POP3 support for standard email clients

### Developer Features
- ✅ RESTful API with API key authentication
- ✅ Programmatic email sending via API
- ✅ DKIM automatic signing and verification
- ✅ Admin dashboard and server management
- ✅ User and domain administration panels

### Security & Integration
- ✅ JWT-based session management
- ✅ bcryptjs password hashing
- ✅ Optional Microsoft Graph / Outlook integration
- ✅ SSL/TLS encryption for all protocols
- ✅ Per-host Let's Encrypt cert (auto-managed by nginx-proxy/acme-companion)

## Technology Stack

### Frontend
- **Next.js 16** – React framework with TypeScript
- **React 19** – UI library
- **Tailwind CSS** – Utility-first styling
- **shadcn/ui** – Component library (Radix UI + Tailwind)

### Backend
- **Next.js API Routes** – Serverless functions
- **PostgreSQL 16** – Relational database
- **JWT** – Token-based authentication
- **bcryptjs** – Password hashing

### Email Infrastructure
- **Postfix** – SMTP relay for outbound mail
- **Dovecot** – IMAP/POP3 server
- **Node.js SMTP Receiver** – Inbound email processing

### Additional Services
- **Docker & Docker Compose** – Containerization
- **Genkit + Google Gemini** – AI integration
- **nginx-proxy** – Reverse proxy with Let's Encrypt support

## Docker Setup

### Services Overview

| Service | Image | Port(s) | Purpose |
|---------|-------|---------|---------|
| **postgres** | postgres:16 | 5432 | Database with auto-initialization |
| **app** | nubmail (custom) | 5000 | Next.js application |
| **smtp-sender** | boky/postfix | 587, 465 | Outbound SMTP relay |
| **smtp-receiver** | node:22 | 25 | Inbound SMTP (Node.js) |
| **dovecot** | Custom | 143, 993, 110, 995 | IMAP/POP3 server |

### Starting Services

```bash
# Build and start all services
docker compose up -d --build

# Start specific services only
docker compose up -d postgres app-dev smtp-sender smtp-receiver

# View logs
docker compose logs -f app

# Stop all services
docker compose down

# Clean up volumes (use with caution)
docker compose down -v
```

### Database Initialization

The PostgreSQL container automatically loads the schema from `docs/postgres-schema.sql` on first run. To manually apply the schema:

```bash
docker exec -i $(docker ps -qf name=postgres) \
  psql -U nubmail -d nubmail < docs/postgres-schema.sql
```

### Production Deployment

#### With nginx-proxy

The application integrates with [jwilder/nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) for:
- Automatic reverse proxy configuration
- SSL/TLS termination
- Virtual host routing

**Configuration:**
```yaml
environment:
  VIRTUAL_HOST: mails.example.com
  VIRTUAL_PORT: 5000
  LETSENCRYPT_HOST: mails.example.com
  LETSENCRYPT_EMAIL: admin@example.com
```

**Setup:**
```bash
# Ensure nginx-proxy is on the same Docker network
docker network create web
docker compose up -d  # Connects to 'web' network by default
```

#### Mail TLS Certificate

Dovecot (IMAP/POP3) and Postfix (SMTP) share the same per-host Let's Encrypt
certificate that `acme-companion` issues for the web app. The cert directory is
bind-mounted directly into both containers — there is no copy step.

By default the bind-mount resolves to `./certs/${HOST}`.
Override the base path or hostname via env vars in `.env`:

```bash
NGINX_CERTS_DIR=/path/to/nginx-proxy/certs   # default: ./certs
HOST=mail.example.com                        # your mail server hostname
```

**Certificate Renewal:**
`acme-companion` renews the cert in place. Dovecot and Postfix only re-read the
cert on reload, so install `scripts/reload-mail-certs.sh` as a daily cron job
to detect changes and reload both services:

```bash
echo "0 3 * * * /root/nubmail/scripts/reload-mail-certs.sh >> /var/log/nubmail-cert-reload.log 2>&1" | crontab -
```

### Email Client Configuration

Connect standard email clients using these settings:

| Protocol | Server | Port | Security |
|----------|--------|------|----------|
| **SMTP** | smtp.example.com | 587 | STARTTLS |
| **IMAP** | imap.example.com | 993 | SSL/TLS |
| **POP3** | pop3.example.com | 995 | SSL/TLS |
| **Webmail** | mails.example.com | 443 | HTTPS |

#### Example: Thunderbird Setup
1. Email: `user@example.com`
2. Password: `your-email-password`
3. IMAP: `imap.example.com:993` (SSL)
4. SMTP: `smtp.example.com:587` (STARTTLS)

## Project Structure

```
nubmail/
├── src/
│   ├── app/                 # Next.js pages & API routes
│   │   ├── api/            # API endpoints
│   │   ├── dashboard/      # Admin dashboard pages
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page
│   ├── components/         # Reusable React components
│   │   ├── ui/            # shadcn/ui components
│   │   └── main-nav.tsx    # Navigation components
│   ├── lib/               # Utility functions
│   │   ├── auth-provider.tsx
│   │   ├── api-keys.ts
│   │   └── utils.ts
│   └── hooks/             # Custom React hooks
├── docs/                  # Documentation & SQL schemas
├── dovecot/              # Dovecot configuration files
├── smtp/                 # SMTP receiver implementation
├── Dockerfile            # Multi-stage Docker build
└── docker-compose.yml    # Compose orchestration
```

## API Reference

### Sending Email with API Keys

Use API keys to programmatically send emails from your application.

#### Step 1: Create an Email Account

Use the dashboard or API to create an email account. Example:
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

**⚠️ Important:** Store the API key securely. You can view it again from the dashboard while the encrypted copy remains available.

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

#### DKIM Signing

- DKIM signatures are **automatically generated** on first send
- Requires a valid domain with proper MX/SPF/DKIM DNS records
- Private keys are stored securely in the database

#### Using Different SMTP Providers

Configure custom SMTP credentials per account:
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
# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

### Database Schema

The PostgreSQL container initializes the schema automatically on first boot from `docs/postgres-schema.sql`. No manual migration scripts are required for a fresh local setup.

## Troubleshooting

### Common Issues

#### Emails not sending
- **Verify DKIM records:** Check DNS for `default._domainkey.example.com`
- **Check SMTP settings:** Verify `SMTP_HOST`, `SMTP_PORT`, and credentials
- **Review logs:** `docker compose logs smtp-sender`

#### Cannot receive emails
- **Check MX records:** Verify DNS MX records point to your server
- **Verify SMTP receiver:** `docker compose logs smtp-receiver`
- **Check firewall:** Ensure port 25 is open and not blocked

#### Database connection errors
- **Verify POSTGRES_URL:** Check environment variable is set correctly
- **Check database status:** `docker compose logs postgres`
- **Reset database:** `docker compose down -v && docker compose up -d postgres`

#### SSL/TLS certificate issues
- **Renew certificates:** follow your deployment's certificate renewal process
- **Check certificate validity:** `openssl x509 -in ${NGINX_CERTS_DIR:-./certs}/${HOST}/fullchain.pem -text`
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

**Setup** (already done on the current VPS):
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

- **Issues & Bugs:** Report on GitHub Issues
- **Documentation:** See `docs/` folder for detailed guides
- **DNS Setup:** `DNS_SETUP_GUIDE.md`
- **SMTP Configuration:** `SMTP_SETUP_GUIDE.md`
- **IMAP/POP3 Setup:** `IMAP_POP3_SETUP_GUIDE.md`

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

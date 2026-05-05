# NubMail

A powerful, lightweight email management system built with **Next.js 16**, **React 19**, and **PostgreSQL**. Designed for developers and organizations that need full control over their email infrastructure.

## Key Features

- 🌐 **Domain Management** – Add custom domains and verify DNS records
- 📧 **Email Accounts** – Create and manage unlimited email accounts per domain
- 📤 **Email Sending** – Send emails via built-in SMTP relay or custom providers
- 📨 **Email Receiving** – Receive inbound emails with automatic storage
- 🔐 **Security** – JWT authentication, API keys, DKIM signing
- 🎨 **Modern UI** – Responsive interface built with shadcn/ui and Tailwind CSS
- 📱 **Multi-Protocol** – IMAP, POP3, SMTP support with SSL/TLS encryption

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
cp .env.example .env  # Configure your variables

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

Create a `.env.local` file in the root directory with the following variables:

```bash
# Application Security
JWT_SECRET=your-secret-key-min-32-chars

# Database
USE_POSTGRES=true
POSTGRES_URL=postgres://nubmail:nubmail@localhost:5432/nubmail

# Email Domain Configuration
DOMAIN=mails.example.com
PROTOCOL=https

# SMTP (optional - defaults to built-in relay)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Microsoft Graph / Outlook Integration (optional)
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_OUTLOOK_REDIRECT_URI=https://your-domain/api/integrations/outlook/callback
TOKEN_ENCRYPTION_KEY=your-32-char-encryption-key

# Admin Account
ADMIN_PASS=secure-admin-password
ADMIN_EMAIL=admin@example.com

# Web Push Notifications (optional)
VAPID_PUBLIC_KEY=your-public-vapid-key
VAPID_PRIVATE_KEY=your-private-vapid-key
VAPID_SUBJECT=mailto:admin@example.com
```

Generate VAPID keys:

```bash
npx web-push generate-vapid-keys
```

### Required Variables Explained

| Variable | Purpose | Example |
|----------|---------|---------|
| `JWT_SECRET` | Authentication token encryption | `sk_test_abc123...` |
| `POSTGRES_URL` | Database connection string | `postgres://user:pass@host:5432/db` |
| `DOMAIN` | Your mail server domain | `mails.example.com` |
| `PROTOCOL` | HTTP or HTTPS | `https` |

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
- ✅ Wildcard certificate support

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
  LETSENCRYPT_HOST: "*.example.com"
  LETSENCRYPT_EMAIL: admin@example.com
```

**Setup:**
```bash
# Ensure nginx-proxy is on the same Docker network
docker network create web
docker compose up -d  # Connects to 'web' network by default
```

#### Wildcard SSL Certificates

Wildcard certificates (*.example.com) are managed by [acme-companion](https://github.com/nginxproxy/acme-companion):

**DNS-01 Challenge (Cloudflare):**
```yaml
environment:
  ACME_CHALLENGE: DNS-01
  ACMESH_DNS_API_CONFIG: '{"DNS_API":"dns_cf","CF_Key":"...","CF_Email":"..."}'
```

**Certificate Renewal:**
Certificates are automatically renewed via your deployment's certificate management process and synced to Dovecot at renewal intervals.

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

# Format code (if prettier configured)
npm run format
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
- **Check certificate validity:** `openssl x509 -in dovecot/ssl/tls.crt -text`
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

## Support & Documentation

- **Issues & Bugs:** Report on GitHub Issues
- **Documentation:** See `docs/` folder for detailed guides
- **DNS Setup:** `DNS_SETUP_GUIDE.md`
- **SMTP Configuration:** `SMTP_SETUP_GUIDE.md`
- **IMAP/POP3 Setup:** `IMAP_POP3_SETUP_GUIDE.md`

## License

[Add your license here]

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Made with ❤️ by NubMail Team**

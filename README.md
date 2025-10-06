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

Create a `.env` file with the following:

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
DOMAIN=mails.nub-coder.tech
PROTOCOL=https

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

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL
- **Authentication**: JWT with bcryptjs
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **AI**: Genkit with Google Gemini

## Docker Configuration

The application includes a Docker setup for PostgreSQL and the app:

- **PostgreSQL**: Persistent database with initialization from `docs/postgres-schema.sql`
- **App (Production)**: Optimized Next.js build running on port 5000
- **App-Dev (Development)**: Hot-reload development environment
- **nginx-proxy Integration**: Automatic SSL with Let's Encrypt

### Docker Services

- `postgres`: PostgreSQL 16 with persistent volumes
- `app-dev`: Development mode with hot reload
- `smtp-sender`: Outbound SMTP relay
- `smtp-receiver`: Inbound SMTP receiver (stores into Postgres)

### nginx-proxy Configuration

The production app is configured to work with nginx-proxy:
- Virtual Host: `mails.nub-coder.tech`
- Virtual Port: `5000`
- Let's Encrypt Host: `mails.nub-coder.tech`
- Let's Encrypt Email: `dev@nub-coder.tech`

Make sure nginx-proxy and letsencrypt-companion are running on the `web` network.

## Project Structure

- `/src/app` - Next.js pages and API routes
- `/src/components` - Reusable React components
- `/src/lib` - Utility functions and shared logic
- `Dockerfile` - Multi-stage Docker build configuration
- `docker-compose.yml` - Docker Compose orchestration

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

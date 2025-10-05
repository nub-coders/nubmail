# NubMail - Email Server Management System

A comprehensive email server management platform built with Next.js 15, MongoDB, and modern web technologies.

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

### Option 2: Docker Deployment

1. Make sure you have Docker and Docker Compose installed

2. Create a `.env` file with your environment variables

3. Start the services:

**Production:**
```bash
docker-compose up -d app
```
Access at: https://mails.nub-coder.tech (via nginx-proxy)

**Development:**
```bash
docker-compose --profile dev up -d app-dev
```

**Stop services:**
```bash
docker-compose down
```

## Environment Variables

Create a `.env` file with the following:

```
JWT_SECRET=your_jwt_secret
MONGODB_URI=your_mongodb_connection_string
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
DOMAIN=mails.nub-coder.tech
PROTOCOL=https
ADMIN_PASS=your_admin_password
ADMIN_EMAIL=your_admin_email
```

## Features

- User authentication with JWT
- Domain management and verification
- Email account creation and management
- Message composition and inbox
- AI-powered features with Google Gemini
- Modern UI with shadcn/ui components

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, MongoDB
- **Authentication**: JWT with bcryptjs
- **UI Components**: shadcn/ui (Radix UI + Tailwind)
- **AI**: Genkit with Google Gemini

## Docker Configuration

The application includes a complete Docker setup with:

- **MongoDB**: Persistent database with authentication
- **App (Production)**: Optimized Next.js build running on port 5000
- **App-Dev (Development)**: Hot-reload development environment
- **nginx-proxy Integration**: Automatic SSL with Let's Encrypt

### Docker Services

- `mongodb`: MongoDB 7.0 with persistent volumes
- `app`: Production-ready application (connected to `web` network for nginx-proxy)
- `app-dev`: Development mode with hot reload (use `--profile dev` flag)

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

FROM node:22-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
# Provide dummy database URL for build time (not used, just prevents build errors)
ENV POSTGRES_URL="postgres://build:build@localhost:5432/build"

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy SMTP receiver source into image (runs in separate service/container)
COPY --chown=nextjs:nodejs smtp ./smtp

# Install dependencies in runner stage
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
# Install PostgreSQL client utilities (provides psql and pg_isready)
RUN apk add --no-cache postgresql-client

# Copy Dovecot configs
COPY dovecot/10-auth.conf /etc/dovecot/conf.d/10-auth.conf
COPY dovecot/auth-sql.conf.ext /etc/dovecot/conf.d/auth-sql.conf.ext
COPY dovecot/dovecot-sql.conf.ext /etc/dovecot/dovecot-sql.conf.ext

USER nextjs

EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"

# Wait for Postgres, then ensure the admin user exists before starting the server
CMD ["sh", "-c", "until pg_isready -h postgres -U nubmail -d nubmail; do echo waiting for postgres; sleep 1; done; node -e \"const { Client } = require('pg'); const bcrypt = require('bcryptjs'); (async () => { const adminEmail = process.env.ADMIN_EMAIL; const adminPass = process.env.ADMIN_PASS; if (!adminEmail || !adminPass) { console.error('ADMIN_EMAIL and ADMIN_PASS environment variables are required'); process.exit(1); } const client = new Client({ connectionString: process.env.POSTGRES_URL }); try { await client.connect(); const checkResult = await client.query('SELECT id FROM users WHERE email = \\$1', [adminEmail.toLowerCase()]); if (checkResult.rows.length > 0) { console.log('Admin user already exists'); return; } const hashedPassword = await bcrypt.hash(adminPass, 10); await client.query('INSERT INTO users (email, password_hash, full_name, is_admin) VALUES (\\$1, \\$2, \\$3, true)', [adminEmail.toLowerCase(), hashedPassword, 'Admin User']); console.log('Admin user created successfully'); } catch (err) { console.error('Error creating admin user:', err); process.exit(1); } finally { await client.end(); } })().catch((err) => { console.error('Admin bootstrap failed:', err); process.exit(1); });\" && node server.js"]

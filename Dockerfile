FROM node:alpine AS base

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
ENV POSTGRES_URL="postgres://nubmail:nubmail@postgres:5432/nubmail"

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
COPY --from=builder /app/scripts ./scripts

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

CMD ["node", "server.js"]

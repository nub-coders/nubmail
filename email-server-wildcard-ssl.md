# Email Server — Wildcard SSL Setup Task

## Context
- Server: `nubcoder` (self-hosted VPS)
- Email already working at: `mails.nubcoder.com`
- Stack: Docker + jwilder/nginx-proxy + nginxproxy/acme-companion
- DNS: Cloudflare (wildcard `*.nubcoder.com` A record already added)
- Goal: Auto wildcard SSL cert `*.nubcoder.com` + add friendly hostnames for mail protocols

---

## Pending Changes

### 1. Add Cloudflare API credentials to acme-companion container

Edit the `docker-compose.yml` where `acme-companion` is defined and add:

```yaml
environment:
  - CF_Key=<cloudflare_global_api_key>
  - CF_Email=<cloudflare_account_email>
  - ACMESH_DNS_API=dns_cf
```

> Get CF_Key from: Cloudflare Dashboard → My Profile → API Tokens → Global API Key

---

### 2. Add wildcard LETSENCRYPT_HOST to any container (e.g. roundcube/mailserver)

On the container exposed via nginx-proxy (e.g. Roundcube), set:

```yaml
environment:
  - LETSENCRYPT_HOST=*.nubcoder.com
  - LETSENCRYPT_EMAIL=you@nubcoder.com
```

This will trigger acme-companion to issue a single wildcard cert covering all subdomains.

---

### 3. Mount the wildcard cert into the mailserver container

Once the cert is issued (stored in `/etc/nginx/certs/`), mount it into the mailserver:

```yaml
  mailserver:
    volumes:
      - /etc/nginx/certs:/etc/nginx/certs:ro
```

Then configure docker-mailserver to use:
```
SSL_CERT_PATH=/etc/nginx/certs/nubcoder.com/fullchain.pem
SSL_KEY_PATH=/etc/nginx/certs/nubcoder.com/privkey.pem
```

---

### 4. Add DNS CNAME records in Cloudflare

| Type  | Name   | Value              |
|-------|--------|--------------------|
| CNAME | `imap` | `mails.nubcoder.com` |
| CNAME | `smtp` | `mails.nubcoder.com` |
| CNAME | `pop3` | `mails.nubcoder.com` |

> Wildcard A record `*.nubcoder.com` already exists — these CNAMEs are for semantic clarity.

---

### 5. Expose mail ports directly on host (bypass nginx-proxy)

In mailserver's docker-compose section, ensure these are published:

```yaml
ports:
  - "25:25"    # SMTP (inbound from other mail servers)
  - "587:587"  # SMTP submission (outgoing)
  - "465:465"  # SMTPS
  - "993:993"  # IMAPS
  - "995:995"  # POP3S
```

> nginx-proxy only handles HTTP/HTTPS — mail ports must be direct.

---

## Final Email Client Settings (after changes)

| Protocol | Hostname              | Port | Security   |
|----------|-----------------------|------|------------|
| IMAP     | `imap.nubcoder.com`   | 993  | SSL/TLS    |
| SMTP     | `smtp.nubcoder.com`   | 587  | STARTTLS   |
| POP3     | `pop3.nubcoder.com`   | 995  | SSL/TLS    |
| Webmail  | `mails.nubcoder.com`  | 443  | HTTPS      |

---

## Verification After Setup

```bash
# Check cert issued correctly
echo | openssl s_client -connect imap.nubcoder.com:993 2>/dev/null | openssl x509 -noout -subject -dates

# Check SMTP
echo | openssl s_client -starttls smtp -connect smtp.nubcoder.com:587

# Check DNS
dig imap.nubcoder.com
dig smtp.nubcoder.com
dig pop3.nubcoder.com
```

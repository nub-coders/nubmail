# DNS Configuration for Built-in SMTP Server

## Current Status Analysis

✅ **Working:**
- Domain resolution: mails.nub-coder.tech → 140.238.100.102
- MX record: nub-coder.tech → mails.nub-coder.tech
- Basic SPF record exists

❌ **Issues to Fix:**
- Missing PTR (reverse DNS) record
- SPF record needs improvement
- No DKIM configured
- No DMARC policy

## Required DNS Records

### 1. PTR Record (Critical - Contact your hosting provider)
**Record Type:** PTR
**IP:** 140.238.100.102
**Value:** mails.nub-coder.tech
**TTL:** 3600

**Note:** This must be set by your hosting provider (VPS/cloud provider). Contact them to set up reverse DNS.

### 2. Update SPF Record
**Domain:** nub-coder.tech
**Record Type:** TXT
**Current:** `v=spf1 include:mails.nub-coder.tech ~all`
**New:** `v=spf1 a mx ip4:140.238.100.102 ~all`

### 3. Add DKIM Record (Recommended)
**Domain:** nub-coder.tech
**Record Type:** TXT
**Name:** default._domainkey
**Value:** `v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY`

### 4. Add DMARC Record (Recommended)
**Domain:** nub-coder.tech
**Record Type:** TXT
**Name:** _dmarc
**Value:** `v=DMARC1; p=quarantine; rua=mailto:dmarc@nub-coder.tech`

## Temporary Solutions (While fixing DNS)

### Option 1: Add IP to SPF immediately
Update your SPF record to include the server IP directly.

### Option 2: Configure DKIM (We can do this now)
Set up DKIM signing in your Postfix configuration.

## Steps to Fix Immediately:

1. **Contact your hosting provider** about PTR record
2. **Update SPF record** to include server IP
3. **Set up DKIM** (we can configure this)
4. **Test email delivery** after each fix

## Commands to Help

Check email delivery status:
```bash
# Test email delivery
docker logs nubmail-smtp-sender --tail 20

# Check mail queue
docker exec nubmail-smtp-sender postqueue -p
```
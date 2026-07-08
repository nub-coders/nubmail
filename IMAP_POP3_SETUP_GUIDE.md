# IMAP/POP3 Setup Guide

## Overview
Your nubmail application now supports IMAP and POP3 access for **email accounts** created by users. Each email account (e.g., `support@example.com`, `verify@example.com`) can be configured with IMAP/POP3 access independently.

**Important:** Authentication is based on **email accounts**, not portal user login credentials. Users authenticate with their email account address and the password set for that specific email account.

## Connection Details

### Server Information
- **Server Address**: Your server's IP address or domain name
- **IMAP Port**: 143 (unencrypted) or 993 (SSL/TLS)
- **POP3 Port**: 110 (unencrypted) or 995 (SSL/TLS)
- **Authentication**: Username and password

### User Credentials
- **Username**: Email account address (e.g., `verify@example.com`, `support@example.com`)
- **Password**: Email account password (set in the `email_accounts` table, not the portal user password)

## Gmail App Setup (Android/iOS)

1. Open the Gmail app
2. Tap your profile picture → **Add another account**
3. Select **Other**
4. Enter your full email address
5. Select **Personal (IMAP)** or **Personal (POP3)**
6. Enter your password
7. Configure incoming mail server:
   - **Server**: Your server's IP/domain
   - **Port**: 143 (IMAP) or 110 (POP3)
   - **Security type**: None (or SSL/TLS if using port 993/995)
   - **Username**: Your full email address
8. Configure outgoing mail server (SMTP):
   - **Server**: Your SMTP server address
   - **Port**: 587 or 25
   - **Security type**: None or STARTTLS
   - **Username**: Your full email address
   - **Password**: Your password
9. Tap **Next** and complete setup

## Thunderbird Setup (Desktop)

1. Open Thunderbird
2. Go to **File** → **New** → **Existing Mail Account**
3. Enter your name, email address, and password
4. Thunderbird will attempt to auto-configure. If it fails:
   - Click **Manual config**
   - Set incoming server:
     - **Protocol**: IMAP or POP3
     - **Server**: Your server's IP/domain
     - **Port**: 143 (IMAP) or 110 (POP3)
     - **SSL**: None
     - **Authentication**: Normal password
   - Set outgoing server (SMTP):
     - **Server**: Your SMTP server address
     - **Port**: 587
     - **SSL**: STARTTLS or None
     - **Authentication**: Normal password
5. Click **Done**

## Outlook Setup (Desktop/Web)

1. Open Outlook
2. Go to **File** → **Add Account**
3. Enter your email address
4. Choose **Advanced options** → **Let me set up my account manually**
5. Select **IMAP** or **POP**
6. Enter server settings:
   - **Incoming mail server**: Your server's IP/domain
   - **Incoming port**: 143 (IMAP) or 110 (POP3)
   - **Outgoing mail server (SMTP)**: Your SMTP server address
   - **Outgoing port**: 587
7. Enter your credentials
8. Complete setup

## iOS Mail App Setup

1. Go to **Settings** → **Mail** → **Accounts**
2. Tap **Add Account** → **Other** → **Add Mail Account**
3. Enter your name, email, password, and description
4. Tap **Next**
5. Select **IMAP** or **POP**
6. Enter incoming mail server:
   - **Host Name**: Your server's IP/domain
   - **User Name**: Your full email address
   - **Password**: Your password
7. Enter outgoing mail server:
   - **Host Name**: Your SMTP server address
   - **User Name**: Your full email address
   - **Password**: Your password
8. Tap **Save**

## Troubleshooting

### Connection Issues
- Verify your server's IP address or domain is correct
- Ensure ports 143 (IMAP) or 110 (POP3) are not blocked by your firewall
- Check that Dovecot is running: `docker compose logs dovecot`

### Authentication Errors
- Verify username is the full email address
- Check password is correct in your database
- Ensure user exists in your `users` table

### Email Not Showing
- Verify emails exist in the database
- Check Dovecot logs: `docker compose logs dovecot`
- Ensure email accounts are properly configured

### SSL/TLS Warnings
- If using ports 993 or 995, you may need to configure SSL certificates
- For testing, you can use unencrypted ports (143 for IMAP, 110 for POP3)

## Viewing Emails via IMAP/POP3

Once configured in your email client, emails should appear automatically. Dovecot queries your database for mailbox contents on each connection.

## Check Dovecot Status

```bash
docker compose logs dovecot
docker compose ps
```

## Restart Dovecot

```bash
docker compose restart dovecot
```

## Managing Email Accounts

Use the Developer dashboard (IMAP/POP3 tab) to create email accounts and set a
password for each one. Any account with a password set can then be accessed over
IMAP/POP3 using the email address as the username, for example:

- `verify@example.com` — Set a password via the Developer dashboard
- `support@example.com`

**Note:** Use the Developer dashboard (IMAP/POP3 tab) to set passwords for each email account.

## Notes

- Emails are stored in `<nubmail-dir>/maildata/[email_username]/Maildir/new/`
- Dovecot configuration is in `<nubmail-dir>/dovecot/`
- IMAP allows syncing across multiple devices
- POP3 downloads emails to a single device (may delete from server)
- Each email account has its own separate password for IMAP/POP3 access
- Users can create multiple email accounts and set up IMAP/POP3 for each one independently

## Setting Passwords for Email Accounts

To set or update a password for an email account:

```bash
# Generate password hash
docker exec nubmail-app node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YourPassword', 10));"

# Update the email account password
docker exec nubmail-postgres-1 psql -U nubmail -d nubmail -c "UPDATE email_accounts SET password_hash = '\$2a\$10\$YourHashHere' WHERE email_address = 'your@email.com';"
```

For additional help, check the Dovecot logs or consult the official Dovecot documentation.

# SMTP Configuration Guide for NubMail

## Current Issue Fixed
The built-in Postfix server was configured for internal relay only. We've updated it to allow external delivery.

## Production Recommendations

### Option 1: Gmail SMTP (Recommended for development)
1. Go to your email accounts in the NubMail admin panel
2. Update the account with:
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - SMTP User: `your-email@gmail.com`
   - SMTP Password: `your-app-password` (not your regular password)
   - Use Built-in SMTP: `false`

**Note**: You'll need to create an App Password in your Google Account settings.

### Option 2: SendGrid (Recommended for production)
1. Sign up for SendGrid
2. Get your API key
3. Configure:
   - SMTP Host: `smtp.sendgrid.net`
   - SMTP Port: `587`
   - SMTP User: `apikey`
   - SMTP Password: `your-sendgrid-api-key`

### Option 3: AWS SES
1. Set up AWS SES
2. Configure:
   - SMTP Host: `email-smtp.us-east-1.amazonaws.com` (or your region)
   - SMTP Port: `587`
   - SMTP User: `your-ses-smtp-username`
   - SMTP Password: `your-ses-smtp-password`

### Option 4: Keep Built-in SMTP (Current Fix)
The built-in Postfix server now allows external delivery. However, be aware:
- Emails might be marked as spam
- No reputation management
- Limited deliverability to major providers

## Testing
Try sending an email now. The configuration should work with the updated Postfix settings.

## Troubleshooting
If issues persist:
1. Check Docker logs: `docker logs nubmail-smtp-sender`
2. Check app logs: `docker logs nubmail-app-dev`
3. Verify email account configuration in database
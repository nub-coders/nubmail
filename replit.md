# NubMail - Email Server Management System

## Overview

NubMail is a comprehensive email server management platform built with Next.js 15, providing users with the ability to manage custom domains, email accounts, and messages. The application features a modern, responsive interface with authentication, domain verification, and email composition capabilities.

**Status**: Fully functional MVP with all critical bugs fixed and Firebase completely removed.

## Recent Changes (October 2025)

### Built-in SMTP Server Integration (Latest - October 6, 2025)
- **Implemented built-in SMTP server using Docker Postfix container**
  - Added `smtp-sender` Docker container (boky/postfix) for sending outgoing emails
  - Email accounts can now use NubMail's built-in SMTP server without requiring external credentials
  - Existing `smtp-receiver` container handles incoming emails on port 25
  - New `smtp-sender` container handles outgoing emails on port 587
  - Automatic routing: accounts with `useBuiltInSmtp=true` use internal SMTP, others use their own credentials
- **Flexible SMTP Configuration**
  - SMTP settings are now optional when creating email accounts
  - Users can choose: (1) Use built-in SMTP (no credentials needed) or (2) Provide custom SMTP server
  - Backend validates complete SMTP credentials only when provided (not required)
  - Email sending logic detects and routes through appropriate SMTP server (internal or external)
- **Enhanced email account creation UI**
  - SMTP settings section marked as optional with clear instructions
  - Form validation allows creating accounts without SMTP credentials
  - Built-in SMTP automatically configured for accounts created without credentials
  - Scrollable dialog for better UX with longer forms

### Individual DNS Record Verification System (October 6, 2025)
- **Implemented comprehensive DNS record verification for email server configuration**
  - Added support for verifying individual DNS record types: TXT, MX, and CNAME
  - New API endpoint `/api/domains/verify-records` checks each record independently
  - Domains are marked as verified only when ALL required records pass verification
  - Added email-related CNAME records: autodiscover, autoconfig, webmail, imap, smtp, pop3
  - Each record shows individual verification status (checkmark for verified, X for failed)
- **Enhanced DNS verification display**
  - DNS record values now wrap with line breaks instead of being truncated
  - Status icons properly positioned and visible for each DNS record type
  - Real-time status updates during verification with loading indicators
  - Partial verification support: shows which records passed and which failed
  - User-friendly toast notifications for verification results

### DNS Verification System Rebuild
- **Rebuilt DNS verification logic with secure token-based verification**
  - Each domain now gets a unique, cryptographically random 64-character verification token
  - Verification only succeeds if the exact TXT record with the token is found in DNS
  - Added strict validation to prevent false positives (empty DNS arrays now properly fail)
  - Implemented 10-second DNS lookup timeout to prevent hanging requests
  - Added status gating to prevent re-verification of already verified domains
  - Domain names are now normalized (lowercase, trimmed, trailing dot removed)
- **Enhanced DNS verification UX**
  - Status icons (checkmarks/X symbols) show immediately when opening DNS setup dialog
  - Icons reflect current domain verification status (verified = green checkmarks, pending = no icons, failed = red X)
  - Icons update in real-time during verification process (spinning loader while checking)
  - Added scrollable area to DNS records list so Verify button remains visible
  - Improved error messages with specific guidance for different DNS failure scenarios

### Bug Fixes & Security Improvements
- Fixed critical email retrieval bug: Inbox now properly filters emails by recipient email address
- Fixed security vulnerability: Email API now prevents unauthorized access to other users' emails with proper user ownership checks
- Fixed sent folder: Now correctly filters emails by sender email address
- Fixed read/unread status: Users can now mark inbox emails as read (previously restricted)
- Added default query filter to prevent unauthorized email access via unknown folder parameters
- **Fixed DNS verification false positives: Domains no longer verify without actual DNS records**

### Feature Enhancements
- Implemented complete email composition with send functionality via Replit Mail service
- Added inbox and sent mail viewing with search and filtering capabilities
- Created email accounts management (create, view, delete)
- Implemented domain verification with proper DNS records (SPF, DKIM, DMARC)
- Added domain deletion capability
- Removed all hardcoded mock data from dashboard and other pages
- Generated proper DNS verification records with complete DKIM keys

### Code Quality
- Removed all Firebase references and dependencies
- Fixed duplicate "use client" directives in page components
- Improved error handling across all API endpoints

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Rendering**
- Next.js 15 with App Router architecture
- React Server Components (RSC) enabled
- Client-side rendering for interactive components with "use client" directive
- TypeScript for type safety across the codebase

**UI Component System**
- shadcn/ui components built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Design system featuring soft blue (#A0C4FF) primary color and light blue (#F0F8FF) background
- Inter font family for both body and headline text
- Responsive sidebar navigation with collapsible states

**State Management**
- React hooks (useState, useEffect) for local component state
- Custom context providers (AuthClientProvider) for global auth state
- react-hook-form with zod validation for form handling
- Toast notifications system for user feedback

### Backend Architecture

**API Structure**
- Next.js API routes (app/api directory structure)
- RESTful endpoint patterns
- JWT-based authentication with token verification
- Server-side data validation and error handling

**Authentication System**
- JWT token-based authentication stored in localStorage
- Custom AuthClientProvider context for auth state management
- Email verification flow with verification codes
- Password validation requiring uppercase, lowercase, numbers, and special characters
- Admin role-based access control

**Data Models**
- User: id, email, fullName, emailVerified, isAdmin, verificationToken
- Domain: id, domainName, verificationStatus (verified/pending/failed), verificationToken, userId, createdAt, verifiedAt
- EmailAccount: id, emailAddress, storageQuota, domainId, userId, smtpHost (optional), smtpPort (optional), smtpUser (optional), smtpPass (optional), useBuiltInSmtp (boolean), createdAt
- EmailMessage: id, sender, recipients, subject, body, sentAt, emailAccountId, userId, read

### Data Storage

**Database Solution**
- PostgreSQL as the primary database (Replit's built-in PostgreSQL service)
- PostgreSQL native driver (pg) for Node.js
- Connection pooling with automatic reconnection
- Tables: users, domains, email_accounts, email_messages

**Database Design Patterns**
- Relational database with foreign key references
- User-based data isolation (user_id field on all tables)
- Timestamp tracking (created_at, sent_at, verified_at fields)
- Status flags (email_verified, verification_status, read)
- Automatic schema initialization on startup

### External Dependencies

**AI & Email Services**
- Genkit AI (Google Gemini 2.5 Flash) for AI-powered features
- Built-in SMTP server using Postfix (Docker container) for sending emails
- SMTP receiver for incoming emails (Node.js container on port 25)
- Email sending with support for attachments and HTML/text formats
- Optional external SMTP integration for custom servers

**Authentication & Security**
- jsonwebtoken for JWT creation and verification
- bcryptjs for password hashing
- Environment-based JWT secret configuration

**Development & Build Tools**
- Next.js with Turbopack for development
- TypeScript compiler for type checking
- ESLint for code quality
- patch-package for dependency modifications

**Third-Party UI Libraries**
- Radix UI component primitives (dialog, dropdown, select, etc.)
- Lucide React for iconography
- Recharts for data visualization
- embla-carousel-react for carousels
- date-fns for date formatting
- class-variance-authority and clsx for conditional styling

**Image Hosting**
- Configured remote patterns for images from:
  - placehold.co
  - images.unsplash.com
  - picsum.photos


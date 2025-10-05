# NubMail - Email Server Management System

## Overview

NubMail is a comprehensive email server management platform built with Next.js 15, providing users with the ability to manage custom domains, email accounts, and messages. The application features a modern, responsive interface with authentication, domain verification, and email composition capabilities.

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
- Domain: id, domainName, verificationStatus (verified/pending/failed), userId, createdAt
- EmailAccount: id, emailAddress, storageQuota, domainId, userId
- EmailMessage: id, sender, recipients, subject, body, sentAt, emailAccountId, userId, read

### Data Storage

**Database Solution**
- MongoDB as the primary database
- MongoDB native driver for Node.js
- Connection pooling with cached client instance
- Collections: users, domains, emailAccounts, emailMessages

**Database Design Patterns**
- Document-based storage with ObjectId references
- User-based data isolation (userId field on all collections)
- Timestamp tracking (createdAt, sentAt fields)
- Status flags (emailVerified, verificationStatus, read)

### External Dependencies

**AI & Email Services**
- Genkit AI (Google Gemini 2.5 Flash) for AI-powered features
- SMTP integration capability through Replit Mail service
- Email sending with support for attachments and HTML/text formats

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

**Firebase Legacy**
- Firebase SDK present but deprecated in favor of custom backend
- Migration in progress from Firestore to MongoDB
- Firebase error handling and hooks remain but throw errors directing to new API endpoints
- Custom event emitter system for error propagation
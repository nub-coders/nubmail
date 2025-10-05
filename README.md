# NubMail - Email Server Management System

A comprehensive email server management platform built with Next.js 15, MongoDB, and modern web technologies.

## Getting Started

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

## Environment Variables

Create a `.env.local` file with the following:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
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

## Project Structure

- `/src/app` - Next.js pages and API routes
- `/src/components` - Reusable React components
- `/src/lib` - Utility functions and shared logic

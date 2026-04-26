# NubMail Bug Report

## Backend & API Routes

### 1. `src/lib/jwt.ts`
*   **Bug description:** The `parseJwt` function attempts to decode JWT payloads using `atob` without proper error handling or signature verification. The backend doesn't seem to enforce database lookups reliably in all places before trusting token data (e.g. `getTokenExpiryMs` blindly trusts client-provided token metadata without verification). While the server uses `jsonwebtoken.verify` correctly, the client-side helper is prone to failure on malformed tokens and can crash the application context.
*   **Severity:** Major
*   **Suggested fix:** Refactor `parseJwt` to strictly return null upon any decoding exception and avoid throwing errors. Ensure all sensitive operations strictly rely on server-side `jsonwebtoken.verify`.

### 2. `src/lib/postgres.ts`
*   **Bug description:** In `getPgPool`, the application initializes the Postgres pool dynamically. However, the initialization block lacks proper unhandled promise rejection catching. If the startup checks fail silently or database is unreachable, queries will fail dynamically later, resulting in an inconsistent application state.
*   **Severity:** Major
*   **Suggested fix:** Catch all exceptions during pool initialization and implement an immediate fallback or explicit application panic (log fatal) so the container/process can restart.

### 3. `src/app/api/auth/reset-password/route.ts` & `src/app/api/auth/forgot-password/route.ts`
*   **Bug description:** The `forgot-password` route directly inserts the verification code as plain text `resetToken` into the database (`verification_code = $1`). This token can be leaked if the database is compromised.
*   **Severity:** Critical
*   **Suggested fix:** Hash the `resetToken` using SHA-256 before storing it in the database, and hash the incoming token during the `reset-password` verification step to compare.

### 4. `src/app/api/emails/send/route.ts`
*   **Bug description:** The application uses string replacement on the `html` field without fully sanitizing the input before persisting it into the database (`html || text?.replace(/\n/g, '<br>')`). Since there is no input sanitization (like DOMPurify on the server), users can send emails containing malicious XSS payloads that will be stored in the DB.
*   **Severity:** Critical
*   **Suggested fix:** Implement a sanitization layer using a library like `isomorphic-dompurify` or `xss` on the `html` input before saving it to the database or passing it to Nodemailer.

### 5. `src/app/api/domains/route.ts`
*   **Bug description:** The `PATCH` route for domain verification performs a `dns.resolveTxt` but lacks robust bounds checking on the array responses, potentially throwing an error if the DNS response is malformed. Additionally, there is a race condition where multiple users could attempt to verify the same domain if the `domain_name` column does not enforce unique constraints scoped by the application correctly.
*   **Severity:** Major
*   **Suggested fix:** Ensure domain verification queries strictly handle empty or malformed DNS array results. Enforce unique constraints on verified domains.

### 6. `src/app/api/accounts/route.ts`
*   **Bug description:** No rate limiting or quotas exist for creating email accounts. A malicious user could send thousands of requests and exhaust the DB connection pool or storage since `POST` directly provisions rows without checking limits (only `defaultQuota` is hardcoded per row).
*   **Severity:** Major
*   **Suggested fix:** Implement rate limiting (e.g., using upstash/redis or memory cache) and enforce a maximum limit of accounts per user or per domain.

## Frontend Components & Logic

### 7. `src/app/dashboard/inbox/[id]/page.tsx`
*   **Bug description:** The email reader component dynamically renders HTML content from the backend. If the backend fails to sanitize the email body (as noted in Bug 4), rendering this content directly in the browser using `dangerouslySetInnerHTML` will execute arbitrary Javascript.
*   **Severity:** Critical
*   **Suggested fix:** Sanitize the HTML payload on the client side using `DOMPurify` before rendering it via `dangerouslySetInnerHTML`.

### 8. `src/app/dashboard/compose/page.tsx`
*   **Bug description:** File attachments lack strict validation for malicious file types (e.g., `.exe`, `.bat`, `.js`). The `handleFiles` function simply reads files into base64 without checking their MIME type against a strict allowlist. This allows sending potentially dangerous files via the SMTP endpoint.
*   **Severity:** Major
*   **Suggested fix:** Add strict MIME type and extension validation in `handleFiles`. Reject non-whitelisted files and alert the user.

### 9. `src/app/dashboard/domains/page.tsx`
*   **Bug description:** In `handleDeleteDomain`, the frontend optimistically updates the domains list but does not handle errors effectively if the state diverges from the server. If the fetch request fails after an optimistic UI update, the user will see a stale state until they refresh.
*   **Severity:** Minor
*   **Suggested fix:** Wrap state updates in the promise resolution block, ensuring the state only updates *after* a successful `res.ok` check. If it fails, revert the state gracefully.

### 10. `src/app/dashboard/settings/page.tsx`
*   **Bug description:** `currentPassword` is stored in React state as plain text. While normal for controlled forms, the password change function `handleChangePassword` lacks strong CSRF protection. If the user clicks a malicious link while authenticated, a state-changing POST request could potentially be initiated.
*   **Severity:** Minor
*   **Suggested fix:** Although API routes use `Bearer` tokens (mitigating CSRF natively), it's good practice to ensure re-authentication or a CSRF token for critical actions like password changes.

### 11. `src/lib/auth-provider.tsx`
*   **Bug description:** The `setTokenInternal` function stores the token in `localStorage`. This makes the application vulnerable to XSS attacks, as any malicious script running on the domain can steal the JWT and impersonate the user.
*   **Severity:** Critical
*   **Suggested fix:** Move authentication to use `httpOnly` secure cookies instead of `localStorage`. Next.js API routes and middleware should handle token validation via cookies.
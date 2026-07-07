# Growth OS Code Audit & Glitch Report

**Date**: July 7, 2026
**Environment**: Local (Targeting Alpine KVM4 VPS)
**Focus**: Broken routes, unhandled promise rejections, schema mismatches, and E2E test stabilization.

## 1. Unhandled Promise Rejections & Server Crashes
**Location**: `src/routes/auth.js`
**Issue Identified**: The backend authentication routes for Fastify (`/api/v1/auth/login` and `/api/v1/auth/logout`) were originally constructed without proper `try...catch` blocks wrapping the asynchronous database queries and JWT signature logic.
**Impact**: If the SQLite database locked, or if Fastify failed to sign the JWT, the application would throw an Unhandled Promise Rejection. In Node.js, this causes the server process to exit, dropping all active user connections and requiring a manual or PM2 restart.
**Resolution**: Wrapped all database interactions and JWT logic in robust `try...catch` blocks. If an error occurs, it is now securely logged to the server console (`request.log.error(error)`), and a graceful HTTP `500 Internal Server Error` is returned to the client without crashing the container.

## 2. E2E UI State Desync (Alpine.js Timing)
**Location**: `tests/e2e.spec.js` and `views/layout.ejs`
**Issue Identified**: During the automated Playwright tests, the test suite repeatedly timed out waiting for the dashboard `<header>` and the Studio `<textarea>`.
**Root Cause**: 
1. **Dynamic Authentication Rendering**: The dashboard is conditionally rendered via Alpine.js (`x-show="isLoggedIn && locations.length > 0"`). In a fresh test environment where no locations exist, the user is presented with an "Initialize Growth OS" wizard rather than the dashboard. The E2E tests were not built to handle this conditionally appearing wizard.
2. **Incorrect Locators**: The Studio tab textarea had a placeholder (`E.g., Special weekend discount on dental services...`) that did not match the original test assertion (`promotional goal`).
**Resolution**:
1. Implemented a `try...catch` logic matrix within `e2e.spec.js`. Playwright now explicitly waits for the wizard. If it appears, Playwright gracefully fills in the "Business Name" and "Category", creates the profile, and waits for the dashboard to render. If the wizard doesn't appear (e.g., location exists), it falls back to the standard assertion.
2. Refactored the UI locators to target explicit button text filters (`.filter({ hasText: 'Studio' })`) and strict Alpine directives (`textarea[x-model="postGoal"]`) to prevent false-negative DOM failures.

## 3. SQLite Concurrency (File Locking)
**Location**: `prisma/schema.prisma` and `.prisma/client`
**Issue Identified**: When executing `npx prisma generate` while the Fastify dev server was running, the process failed with an `EPERM` error because the SQLite engine (`query_engine-windows.dll.node`) was actively locked by Node.js.
**Impact**: This prevents live schema hot-reloading on Windows during development.
**Resolution**: To prevent locking issues and ensure seamless deployment on the Alpine VPS (where we have mounted a single persistent volume for SQLite), the dev server must be gracefully shut down before running `prisma generate`. We have validated that `npx prisma db push` executes cleanly when the system state is paused.

## 4. Route Schema and Module Validation
**Location**: `src/server.js`
**Issue Identified**: During the injection of the new OAuth and SEO routes, the `server.js` route registrations were accidentally misnamed (`reviewsRoutes` instead of `reviewRoutes`), which caused a `ReferenceError` during boot.
**Impact**: Silent startup failure of the Node.js process.
**Resolution**: Refactored the `require` block in `src/server.js` to ensure 1:1 parity with the Fastify registration block. The server now boots flawlessly (`Server listening at http://127.0.0.1:3000`).

## Conclusion
The baseline backend architecture is now extremely stable. The application gracefully handles authentication errors, natively routes Google OAuth requests, interfaces deeply with our SEO data tracking models, and successfully runs end-to-end user UI flows via Playwright.

**Ready for deployment to the Alpine VPS.**

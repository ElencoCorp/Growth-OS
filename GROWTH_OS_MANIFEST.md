# Growth OS System Manifest

## 1. DATABASE LOGIC
Our system utilizes a local SQLite database (`dev.db`) managed through Prisma ORM to ensure pristine data models and zero external dependencies.
- **Multi-Tenant Hierarchy:** Data is strictly isolated across an `Organization` -> `Business` -> `Location` relational configuration. All core metrics, reviews, and AI-generated posts roll up to specific local profiles.
- **User Authorization:** Secure login workflows leverage the `User` table, checking `email` and encrypted `passwordHash`. Sessions are issued via Fastify JWTs stored in strict HTTP-only cookies.
- **Role-Based Access:** Core routes are protected by pre-validation hooks (`fastify.requireAdmin` and `fastify.authenticate`) to enforce `Administrator` or `Client` boundaries.

## 2. AI ENGINE ARCHITECTURE
Our content generation pipeline strictly runs natively on local hardware via Ollama.
- **Local Engine Integration:** All requests are piped directly to `http://localhost:11434/api/generate` using the `llama3.2:1b` model.
- **Programmatic Boundaries & Enforcements:**
  - *Google Business Posts:* Enforced strict character length boundaries (minimum 500 characters, targeting 1500 chars). The AI is programmatically forced to append exactly 5 targeted local SEO keywords and 5 trending local hashtags at the bottom.
  - *Self-Healing Loops:* If the AI model hallucinates or fails length/hashtag checks, a fallback validation loop triggers internal retries to adjust constraints and force compliance.
  - *Review Replies:* Programmatic limitations ensure max 2-3 sentence outputs and strictly localized replies, bypassing any generic AI templates.

## 3. UI INTERACTIVE HOOKS
Our client-side shell is built on Alpine.js, avoiding heavy frontend compilers for maximum speed.
- **Grid Layout Parameters:** Fluid, responsive dashboard widgets (Competitor Radar, Analytics) rendered conditionally via `x-show` and dynamic `x-transition` directives.
- **Custom Calendar Scripts:** A bespoke Alpine-based Date/Time picker embedded natively in the AI Content Studio. It programmatically calculates month day-offsets without relying on bloated external dependencies like Moment.js.
- **Full-Screen Lightbox Listeners:** Reactive image previews using `@click="activeLightboxImage = post.imageUrl"` to trigger a cinematic modal overlay for AI-generated banners.

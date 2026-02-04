# ShipAny Template Two Project Rules

## 1. Project Context
This project is built using the **ShipAny Template Two**, a production-ready Next.js AI SaaS boilerplate. It focuses on speed of delivery ("Ship Fast"), AI integration, and a scalable architecture.

## 2. Tech Stack
- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **UI Library**: React 19, Tailwind CSS v4, Shadcn UI (Radix Primitives), Framer Motion
- **Database & ORM**: Drizzle ORM (Supports MySQL/Postgres/SQLite)
- **Authentication**: Better Auth
- **AI Integration**: Vercel AI SDK (`ai`), AI Elements
- **Payments**: Stripe, PayPal, Creem
- **Internationalization**: next-intl
- **Documentation**: Fumadocs

## 3. Directory Structure
Follow this structure strictly when adding new files:

- **`src/app/[locale]/`**: Application routes. All pages must be localized.
- **`src/core/`**: Core system configurations.
  - `auth/`: Authentication configuration (Better Auth).
  - `db/`: Database schema and connection.
  - `rbac/`: Role-Based Access Control logic.
- **`src/extensions/`**: Third-party service integrations.
  - `ai/`: AI providers (Gemini, Replicate, etc.).
  - `payment/`: Payment providers (Stripe, etc.).
  - `storage/`, `email/`, `analytics/`.
- **`src/shared/`**: Reusable code.
  - `blocks/`: Larger UI compositions (business components).
  - `components/ui/`: Base UI components (Shadcn).
  - `hooks/`: Custom React hooks.
- **`src/config/`**: Configuration files (Locale messages, DB schema definitions).

## 4. Coding Guidelines

### UI & Styling
- **Use Shadcn UI**: Always check `src/shared/components/ui` before creating custom components.
- **Tailwind CSS**: Use utility classes for styling. Avoid CSS files unless for global styles.
- **Responsive Design**: Mobile-first approach.
- **Icons**: Use `lucide-react` or `@tabler/icons-react`.

### Database (Drizzle ORM)
- Define schemas in `src/config/db/` (e.g., `schema.ts`).
- Run `pnpm db:generate` and `pnpm db:migrate` (or `db:push`) after schema changes.
- Use `src/core/db` for database connection instances.

### Authentication & Permissions
- Use `better-auth` for user management.
- Implement RBAC checks using utilities in `src/core/rbac/`.
- Protect routes in `middleware.ts` or layout files.

### Internationalization (i18n)
- All user-facing text must be wrapped in `next-intl` translation functions (`t('key')`).
- Add translation keys to `src/config/locale/messages/{en,zh}/`.

### AI Integration
- Use Vercel AI SDK (`useChat`, `useCompletion`) for AI features.
- Place AI logic in `src/extensions/ai/` and expose unified interfaces.

## 5. Workflow & Best Practices
- **Package Manager**: Use `pnpm`.
- **Scripts**:
  - `pnpm dev`: Start development server.
  - `pnpm db:studio`: Manage database content visually.
  - `pnpm auth:generate`: Generate auth schema.
- **File Naming**: Kebab-case for files and directories (e.g., `user-profile.tsx`).
- **Component Naming**: PascalCase for components (e.g., `UserProfile`).

## 6. AI Agent Behavior
- **Context Awareness**: Always check `package.json` and `src/extensions` to see what is already installed.
- **Modularity**: When asked to add a feature, prefer creating an extension in `src/extensions` or a block in `src/shared/blocks`.
- **Safety**: Do not modify `src/core` unless explicitly instructed or necessary for architecture changes.

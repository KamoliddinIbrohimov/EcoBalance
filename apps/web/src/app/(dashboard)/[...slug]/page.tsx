import { UnderDevelopment } from '@/shared/components/layout/under-development';

/**
 * Catch-all route for the dashboard shell.
 *
 * Any sidebar link that does not yet have a dedicated page (e.g. /monitoring,
 * /reports, /users, /settings/...) falls through to this route and renders the
 * "coming soon" placeholder inside the shell (sidebar + topbar preserved).
 *
 * Once a real page is added at the target path, that page wins over this
 * catch-all thanks to Next.js route priority.
 */
export default function UnderDevelopmentCatchAll() {
  return <UnderDevelopment />;
}

import { UnderDevelopment } from '@/shared/components/layout/under-development';

/**
 * Root-level 404. Used when the URL does not match any route at all
 * (outside the dashboard shell). Uses the same friendly placeholder
 * so users never see a black default 404.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <UnderDevelopment />
    </div>
  );
}

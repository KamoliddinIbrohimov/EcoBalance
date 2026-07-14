import { TreePine, Users2 } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { NEWS, type NewsItem } from '../data/mock';

/**
 * News feed for the dashboard. Renders items as a vertical stack — fits
 * naturally in the right sidebar column alongside Education + Reports.
 */
export function NewsCard() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Yangiliklar</CardTitle>
        <Link
          href="/news"
          className="text-xs font-semibold text-primary transition-colors hover:underline"
        >
          Barchasini ko&apos;rish
        </Link>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 pt-0">
        {NEWS.map((n) => (
          <NewsRow key={n.id} item={n} />
        ))}
      </CardContent>
    </Card>
  );
}

function NewsRow({ item }: { item: NewsItem }) {
  const isGreen = item.thumbnailHue === 'green';
  return (
    <article className="flex gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${
          isGreen ? 'bg-primary-soft text-primary' : 'bg-info-soft text-info'
        }`}
        aria-hidden
      >
        {isGreen ? <TreePine className="h-6 w-6" /> : <Users2 className="h-6 w-6" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-3 text-sm leading-snug text-foreground">{item.title}</p>
        <time className="mt-1.5 block text-xs text-muted-foreground">{item.date}</time>
      </div>
    </article>
  );
}

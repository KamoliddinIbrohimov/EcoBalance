'use client';

import type { CourseDto } from '@eco/shared';
import { BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/shared/components/ui/badge';
import { Card } from '@/shared/components/ui/card';

interface CourseCardProps {
  course: CourseDto;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link href={`/learning/${course.slug}`} className="group block">
      <Card className="flex h-full flex-col justify-between gap-4 p-6 transition-colors hover:border-primary/60">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <Badge variant={course.isPublished ? 'default' : 'secondary'}>
              {course.isPublished ? 'Nashr etilgan' : 'Qoralama'}
            </Badge>
          </div>
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
            {course.nameUz}
          </h3>
          {course.descriptionUz ? (
            <p className="line-clamp-3 text-sm text-muted-foreground">{course.descriptionUz}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 pt-3 text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground">{course.lessonsCount}</span> ta dars
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
        </div>
      </Card>
    </Link>
  );
}

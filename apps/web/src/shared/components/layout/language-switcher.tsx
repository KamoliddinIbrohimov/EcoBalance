'use client';

import { useLocale } from 'next-intl';
import { useState } from 'react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

type AppLocale = 'uz' | 'ru' | 'en';
const LOCALE_COOKIE = 'eco-locale';

const OPTIONS: Array<{ value: AppLocale; label: string; short: string }> = [
  { value: 'uz', label: 'O‘zbekcha', short: 'UZ' },
  { value: 'ru', label: 'Русский', short: 'RU' },
  { value: 'en', label: 'English', short: 'EN' },
];

export function LanguageSwitcher() {
  const currentLocale = useLocale() as AppLocale;
  const [value, setValue] = useState<AppLocale>(currentLocale);

  const onChange = (v: string) => {
    const next = v as AppLocale;
    setValue(next);
    // 1 yil davomida saqlanadigan cookie
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
    // Full reload — server-side yangi til bilan sahifa qayta yuklanadi.
    window.location.reload();
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 w-auto gap-2 border-0 bg-transparent px-3 hover:bg-secondary">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="mr-1 font-mono text-[10px] text-muted-foreground">{opt.short}</span>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

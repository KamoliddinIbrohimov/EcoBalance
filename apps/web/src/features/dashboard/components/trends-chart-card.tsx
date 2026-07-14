'use client';

import { ChevronDown } from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { TREND_SERIES } from '../data/mock';

const SERIES = [
  { key: 'airQuality',   label: 'Havo sifati',     color: 'hsl(142 71% 45%)' },
  { key: 'waterQuality', label: 'Suv sifati',      color: 'hsl(217 91% 60%)' },
  { key: 'greenAreas',   label: 'Yashil hududlar', color: 'hsl(24 95% 53%)'  },
] as const;

export function TrendsChartCard() {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Ekologik ko&apos;rsatkichlar dinamikasi</CardTitle>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
        >
          Oylar bo&apos;yicha
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-full min-h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={TREND_SERIES}
              margin={{ top: 10, right: 20, bottom: 4, left: -12 }}
            >
              <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))' }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

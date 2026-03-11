import { subMonths, subYears, startOfYear } from 'date-fns';
import type { ChartRange } from '@/types/portfolio';

export function rangeToStartDate(range: ChartRange): string | null {
  const now = new Date();
  switch (range) {
    case '1M': return subMonths(now, 1).toISOString().split('T')[0];
    case '3M': return subMonths(now, 3).toISOString().split('T')[0];
    case '6M': return subMonths(now, 6).toISOString().split('T')[0];
    case 'YTD': return startOfYear(now).toISOString().split('T')[0];
    case '1Y': return subYears(now, 1).toISOString().split('T')[0];
    case 'SINCE_START': return null;
  }
}

export function rangeLabel(range: ChartRange): string {
  return range === 'SINCE_START' ? 'Since Start' : range;
}

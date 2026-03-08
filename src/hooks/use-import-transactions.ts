import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { checkAndEnqueueBackfill } from '@/hooks/use-check-nav-coverage';
import type { ValidatedRow } from '@/lib/csv/validate-row';

const NORM = (s: string | null | undefined): string => s?.trim().toUpperCase() ?? '';
const CHUNK_SIZE = 50;

interface ImportResult {
  imported: number;
  fundsCreated: number;
  failed: number;
  warnings: string[];
}

export function useImportTransactions() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (rows: ValidatedRow[]): Promise<ImportResult> => {
      const warnings: string[] = [];
      let fundsCreated = 0;

      // 1. Collect unresolved fund codes
      const unresolvedCodes = new Set<string>();
      for (const r of rows) {
        if (!r.resolvedFundId && r.parsed) {
          unresolvedCodes.add(NORM(r.rawFundCode));
        }
      }

      // Build fundCode → fundId map from already resolved
      const fundIdMap = new Map<string, string>();
      for (const r of rows) {
        if (r.resolvedFundId && r.parsed) {
          fundIdMap.set(NORM(r.rawFundCode), r.resolvedFundId);
        }
      }

      // 2. Resolve unresolved funds via SEC directory
      if (unresolvedCodes.size > 0) {
        // Paginate sec_fund_directory — table has 14k+ rows, exceeds default 1000 limit
        type SecEntry = { proj_id: string; proj_abbr_name: string; proj_name_en: string | null; proj_name_th: string | null; amc_name: string | null };
        const allSecEntries: SecEntry[] = [];
        let secFetchError: string | null = null;
        {
          let offset = 0;
          const PAGE = 1000;
          while (true) {
            const { data, error: secErr } = await supabase
              .from('sec_fund_directory')
              .select('proj_id, proj_abbr_name, proj_name_en, proj_name_th, amc_name')
              .range(offset, offset + PAGE - 1);

            if (secErr) {
              secFetchError = 'Failed to query SEC fund directory: ' + secErr.message;
              break;
            }
            if (!data || data.length === 0) break;
            allSecEntries.push(...(data as SecEntry[]));
            if (data.length < PAGE) break;
            offset += PAGE;
          }
        }

        if (secFetchError) {
          warnings.push(secFetchError);
        } else {
          // Build SEC lookup map
          const secByAbbr = new Map<string, typeof allSecEntries[0]>();
          for (const entry of allSecEntries) {
            secByAbbr.set(NORM(entry.proj_abbr_name), entry);
          }

          let matchCount = 0;
          for (const code of unresolvedCodes) {
            const secEntry = secByAbbr.get(code);
            if (secEntry) {
              matchCount++;
              // Check again if fund exists (another row may have created it)
              const { data: existCheck } = await supabase
                .from('funds')
                .select('id, fund_code, sec_fund_code');

              const existing = existCheck?.find((f) => {
                return NORM(f.sec_fund_code) === code || NORM(f.fund_code) === code;
              });

              if (existing) {
                fundIdMap.set(code, existing.id);
              } else {
                // Create fund
                const fundName = secEntry.proj_name_en || secEntry.proj_name_th || secEntry.proj_abbr_name;
                const { data: newFund, error: insertErr } = await supabase
                  .from('funds')
                  .insert({
                    fund_code: secEntry.proj_abbr_name,
                    sec_fund_code: secEntry.proj_abbr_name,
                    fund_name: fundName,
                    amc_name: secEntry.amc_name || 'Unknown',
                    is_active: true,
                    currency: 'THB',
                  })
                  .select('id')
                  .single();

                if (insertErr) {
                  warnings.push(`Failed to create fund "${secEntry.proj_abbr_name}": ${insertErr.message}`);
                } else {
                  fundIdMap.set(code, newFund.id);
                  fundsCreated++;
                }
              }
            }
          }

          // Check for codes with no SEC match at all
          const stillUnresolved: string[] = [];
          for (const code of unresolvedCodes) {
            if (!fundIdMap.has(code)) stillUnresolved.push(code);
          }

          if (stillUnresolved.length > 0 && matchCount === 0 && allSecEntries.length === 0) {
            warnings.push(
              `SEC Fund Directory appears empty. Consider refreshing it in Settings before importing. Unresolved funds: ${stillUnresolved.join(', ')}`,
            );
          } else if (stillUnresolved.length > 0) {
            warnings.push(`Could not resolve funds: ${stillUnresolved.join(', ')}. These rows will be skipped.`);
          }
        }
      }

      // 3. Build insert objects + track fund/date pairs for backfill
      const insertRows: Array<Record<string, unknown>> = [];
      let skippedNoFund = 0;
      const fundDatePairs = new Map<string, string>(); // fundId → min trade_date

      for (const r of rows) {
        if (!r.parsed) continue;
        const code = NORM(r.rawFundCode);
        const fundId = r.resolvedFundId ?? fundIdMap.get(code);
        if (!fundId) {
          skippedNoFund++;
          continue;
        }

        const tradeDate = r.parsed.trade_date.substring(0, 10);

        // Track minimum trade_date per fund for backfill
        const existing = fundDatePairs.get(fundId);
        if (!existing || tradeDate < existing) {
          fundDatePairs.set(fundId, tradeDate);
        }

        const obj: Record<string, unknown> = {
          fund_id: fundId,
          tx_type: r.parsed.tx_type,
          trade_date: r.parsed.trade_date,
          units: r.parsed.units ?? 0,
          amount: r.parsed.amount ?? 0,
          nav_at_trade: r.parsed.nav_at_trade ?? 0,
          note: r.parsed.note,
          dividend_type: r.parsed.dividend_type,
        };

        // Fee: omit if null so DB default (0) applies; never insert null
        if (r.parsed.fee != null) {
          obj.fee = r.parsed.fee;
        }

        insertRows.push(obj);
      }

      if (skippedNoFund > 0) {
        warnings.push(`${skippedNoFund} row(s) skipped due to unresolved fund codes.`);
      }

      // 4. Batch insert in chunks
      let imported = 0;
      let failed = 0;

      for (let i = 0; i < insertRows.length; i += CHUNK_SIZE) {
        const chunk = insertRows.slice(i, i + CHUNK_SIZE);
        const { error } = await supabase.from('transactions').insert(chunk as any);
        if (error) {
          failed += chunk.length;
          warnings.push(`Chunk ${Math.floor(i / CHUNK_SIZE) + 1} failed (${chunk.length} rows): ${error.message}`);
        } else {
          imported += chunk.length;
        }
      }

      // 5. Backfill check for imported funds
      if (imported > 0) {
        let backfillCount = 0;
        for (const [fundId, minDate] of fundDatePairs) {
          try {
            const enqueued = await checkAndEnqueueBackfill(fundId, minDate);
            if (enqueued) backfillCount++;
          } catch {
            // Non-critical — don't fail the import
          }
        }
        if (backfillCount > 0) {
          warnings.push(`${backfillCount} fund(s) queued for historical NAV backfill.`);
        }
      }

      // 6. Cache invalidation
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['funds'] }),
        qc.invalidateQueries({ queryKey: ['funds', 'active'] }),
        qc.invalidateQueries({ queryKey: ['holdings'] }),
        qc.invalidateQueries({ queryKey: ['portfolio_snapshots'] }),
        qc.invalidateQueries({ queryKey: ['all_nav_history'] }),
      ]);

      return { imported, fundsCreated, failed, warnings };
    },
  });
}

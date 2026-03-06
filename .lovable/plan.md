

# CSV Transaction Import — Implementation Plan

Already approved in previous messages. Proceeding with exact specification plus user's adjustments:

1. **No generic `new Date()` fallback** — if date doesn't match YYYY-MM-DD or DD/MM/YYYY, row is marked invalid.
2. **Null-safe duplicate key** — null/undefined/empty values normalized to empty string consistently in composite key.
3. **Fee handling** — omit fee from insert when null so DB default (0) applies; never insert null.
4. **Per-chunk error reporting** — partial success/failure tracked and reported.
5. **Consistent NORM()** — `s.trim().toUpperCase()` used everywhere for fund code matching.
6. **SEC directory warning** — if unresolved funds remain and SEC directory has no matches, warn user.

## New Dependency
- `papaparse` + `@types/papaparse` (dev)

## New Files (6)

### 1. `src/lib/csv/parse-csv.ts`
Papa Parse wrapper: `parseCsvFile(file)` → `{ headers, rows }`. Plus `generateCsvTemplate()` and `downloadCsvTemplate()` for sample CSV download.

### 2. `src/lib/csv/column-mapping.ts`
`APP_FIELDS` constant (10 fields with key/label/required). `HEADER_SYNONYMS` map. `autoDetectMapping(csvHeaders)` → `{ appFieldKey → csvHeader }`.

### 3. `src/lib/csv/normalize-tx-type.ts`
`normalizeTxType(raw)` → `TxType | null`. `normalizeDividendType(raw)` → `DividendType | null`. Case-insensitive with common variations.

### 4. `src/lib/csv/validate-row.ts`
`validateRows(rawRows, mapping, existingFunds, existingTransactions)` → `ValidatedRow[]`.

Key behaviors:
- `NORM = (s) => s?.trim().toUpperCase() ?? ''` used for all fund code matching
- Date parsing: supports `YYYY-MM-DD` and `DD/MM/YYYY` only. No `new Date()` fallback — unrecognized formats → invalid
- Numeric parsing: strips commas, returns `null` for missing/empty values (not 0)
- Duplicate key: `generateDuplicateKey(fundId, txType, tradeDate, amount, units, nav)` — each null/undefined field normalized to empty string for stable matching
- Type-specific rules:
  - `buy`/`switch_in`: requires amount > 0, OR both units > 0 and NAV > 0
  - `sell`/`switch_out`: requires units > 0
  - `dividend`: requires amount > 0 or units > 0
- Status: `invalid` (hard errors, blocked), `warning` (e.g. unresolved fund, importable), `valid` (clean), `duplicate` (skipped)

### 5. `src/hooks/use-import-transactions.ts`
Mutation hook `useImportTransactions`.

Input: `ValidatedRow[]` (valid + warning rows).

Process:
1. **Fund resolution pass**: Collect unique unresolved fund codes. Query `sec_fund_directory` with NORM matching. For matches, create fund (same as `useEnsureFund`). Build complete `fundCode → fundId` map. If SEC directory returns zero rows for unresolved codes, include warning.
2. **Transaction insertion**: Build insert objects from validated rows using resolved fund IDs. Fee: omit field if parsed fee is null (DB default 0 applies). Other numeric fields: the transactions table has `units`, `amount`, `nav_at_trade` as NOT NULL — for valid rows these are guaranteed present by type-specific validation. Batch insert in chunks of 50. Track per-chunk success/failure counts.
3. **Cache invalidation**: `transactions`, `funds`, `['funds', 'active']`, `holdings`, `portfolio_snapshots`, `all_nav_history`.

Returns: `{ imported, fundsCreated, failed, warnings[] }`.

### 6. `src/components/transactions/ImportCsvDialog.tsx`
Multi-step Dialog with 5 states:

**Step 1 — Upload**: Drag-and-drop zone + file picker. Accept `.csv`. Show filename + row count. "Download Template" link.

**Step 2 — Column Mapping**: Select dropdown per app field with CSV headers. Pre-populated via `autoDetectMapping`. Required fields marked `*`. Next disabled until required fields mapped.

**Step 3 — Validation Preview**: Fetches existing transactions + funds, runs `validateRows`. Table with color-coded badges. Filter tabs: All | Valid | Warning | Invalid | Duplicate. Row-level errors/warnings inline. Summary bar. If unresolved funds and SEC directory empty, show alert suggesting refresh.

**Step 4 — Confirm**: Summary counts. "Import Transactions" button with loading. Shows warnings about new funds to create.

**Step 5 — Success Summary**: Imported count, funds created, rows skipped, any chunk failures. "Done" button closes.

Step indicator at top, Back/Next navigation, Cancel.

## Modified File (1)

### `src/pages/Transactions.tsx`
- Add `Upload` icon import
- Add `[importOpen, setImportOpen]` state
- Add "Import CSV" outline button next to "Add Transaction"
- Render `<ImportCsvDialog open={importOpen} onClose={() => setImportOpen(false)} />`


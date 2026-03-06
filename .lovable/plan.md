

# Thai Mutual Fund Portfolio Tracker — Implementation Plan

## Phase 1: Supabase Schema & Seed Data

### Migrations
- Create DB enums: `tx_type` (buy, sell, dividend, switch_in, switch_out), `dividend_type` (cash, reinvest)
- **funds** table: id, fund_code (unique), fund_name, amc_name, category, asset_class, risk_level (1-8), currency (default 'THB'), is_active (default true), created_at, updated_at
- **transactions** table: id, fund_id (FK), tx_type (enum), trade_date, units, amount, nav_at_trade, fee (default 0), note, dividend_type (enum, nullable), created_at, updated_at
- **nav_history** table: id, fund_id (FK), nav_date, nav_per_unit, fetched_at, source, updated_at — unique(fund_id, nav_date)
- **portfolio_snapshots** table: id, snapshot_date (unique), total_value, total_cost, total_gain_loss, total_return_percent, latest_nav_date, created_at
- Simple single-user RLS: authenticated users get full CRUD on all tables
- Seed 5 Thai funds (SCBSET, KFGTECH-A, B-INNOTECH, ONE-UGG-RA, KKP PGE-H), ~90 days NAV history, sample transactions, portfolio snapshots

## Phase 2: TypeScript Types & Data Layer

### Types
- Union types matching DB enums: `TxType = 'buy' | 'sell' | 'dividend' | 'switch_in' | 'switch_out'`, `DividendType = 'cash' | 'reinvest'`
- DB row types for all tables, computed `Holding` type (units, avg_cost, market_value, gain_loss, return_pct, allocation_pct)

### Supabase Hooks (React Query)
- CRUD hooks for funds, transactions, nav_history, portfolio_snapshots
- NAV lookup hook by fund_id + date (returns null if not found)

### Holdings Computation (Average Cost Method)
- Process transactions chronologically per fund:
  - **Buy/Switch In**: total_units += units, total_cost += amount + fee
  - **Sell/Switch Out**: cost_reduction = (sell_units / total_units) × total_cost; total_units -= units, total_cost -= cost_reduction
  - **Dividend (cash)**: no unit/cost change
  - **Dividend (reinvest)**: total_units += units, total_cost += amount
- **When total_units reaches zero**: reset avg_cost to 0, exclude from active holdings (show only in historical view)
- avg_cost = total_cost / total_units, market_value = total_units × latest_nav, allocation_pct = market_value / portfolio_total × 100

### Performance Helpers
- 1M, 3M, Since First Buy returns computed from NAV history + first transaction date

## Phase 3: Layout & Navigation
- Collapsible Shadcn Sidebar with icons: Dashboard, Holdings, Transactions, Settings
- Routes including /funds/:id for Fund Detail
- Responsive header with SidebarTrigger
- Premium minimal Wealthfront/Kubera styling: neutral palette, whitespace, subtle borders

## Phase 4: Dashboard
- **Hero**: Full-width Portfolio Value line chart from portfolio_snapshots with value + return % overlay, **1M / 3M / ALL toggle** buttons to filter date range
- Stat cards: Total Cost, Gain/Loss, Return %
- Top 3 Gainers / Worst 3 Performers side-by-side cards (color-coded green/red, mini sparklines)
- Allocation donut chart + holdings summary table (with allocation %)
- Footer: latest NAV date, last sync time

## Phase 5: Holdings Page
- Sortable/filterable table: fund name, AMC, asset class, units, avg cost, latest NAV, market value, gain/loss, return %, allocation %
- Only shows funds with units > 0 by default (zero-unit funds excluded)
- Row click → /funds/:id
- Empty state

## Phase 6: Transactions Page
- Transaction list with type badges, fund name, date, amount, units
- **Side drawer (Sheet)** for add/edit with dynamic Zod-validated form per tx_type:
  - **Buy/Switch In**: amount input active, units computed read-only, fee input; cost basis = amount + fee
  - **Sell/Switch Out**: units input active, amount computed read-only, fee input; validates units ≤ current holding
  - **Dividend**: cash/reinvest toggle, amount input, units computed if reinvest
- All fields validated: no negative values, required fields enforced per type
- **NAV auto-fill** from nav_history; if not found → inline warning + manual nav_at_trade input allowed
- Inline delete with confirmation

## Phase 7: Fund Detail Page
- Fund info card (asset_class, risk_level badge, is_active status)
- **Performance summary row**: 1M, 3M, Since First Buy returns
- NAV history line chart
- Transaction history table for that fund
- Holding metrics (units, avg cost, market value, gain/loss)

## Phase 8: Settings
- Portfolio name, currency (THB), placeholders for data sync & import/export

## Design Principles
- Wealthfront/Kubera aesthetic: calm, minimal, premium
- Green for gains, red for losses, muted Recharts palette
- Loading skeletons, friendly empty states, fully responsive
- Modular component architecture with clean TypeScript throughout


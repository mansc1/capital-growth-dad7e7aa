

## Fix: Compute units for buy transactions in Add mode

**File:** `src/components/transactions/TransactionDrawer.tsx`

**Single change** at lines 304-316 — after resolving `navToSave`, compute `unitsToSave` for Add mode buy/switch_in:

```ts
const navToSave = editTransaction
  ? values.nav_at_trade
  : (nav !== null && nav > 0) ? nav : 0;

const isBuyType = values.tx_type === 'buy' || values.tx_type === 'switch_in';
const unitsToSave = editTransaction
  ? values.units
  : (isBuyType && navToSave > 0 && values.amount > 0)
    ? values.amount / navToSave
    : values.units;

const payload = {
  fund_id: fundId,
  tx_type: values.tx_type as TxType,
  trade_date: values.trade_date,
  units: unitsToSave,
  amount: values.amount,
  nav_at_trade: navToSave,
  fee: values.fee,
  note: values.note || null,
  dividend_type: isDividend ? (values.dividend_type as DividendType) : null,
};
```

This ensures Add mode buy/switch_in transactions compute `units = amount / nav` instead of relying on form state (which stays 0). Edit mode and sell/dividend flows are untouched.




# Refactor Transaction Drawer: System-Managed NAV

## What Changes

Single file: `src/components/transactions/TransactionDrawer.tsx`

### 1. Replace NAV input field (lines 500-525) with conditional rendering

**Add mode** (`!editTransaction`): Render a read-only informational block instead of the input field:
- If `nav` exists → show formatted NAV value (e.g. `10.2345`) with subtle styling
- If loading → show "Looking up NAV…"
- If no NAV → show "Historical NAV will be fetched automatically after saving."
- No input field rendered at all

**Edit mode** (`editTransaction`): Keep the existing editable input field and all current behavior unchanged.

### 2. Update `renderNavHelper()` (lines 356-390)

Split helper text logic:
- In **Add mode**, the helper text is embedded directly in the read-only block (no separate helper needed)
- In **Edit mode**, keep existing helper text behavior but update the "no NAV" message to: *"NAV for this date is not available yet. Saving will trigger an automatic historical NAV update."*

### 3. No other changes needed

- NAV autofill hook (`useNavForTradeDate`) stays — it still runs in Add mode to display the read-only value
- Schema keeps `nav_at_trade` with `0` as default — Add mode always submits the autofilled value or `0`
- Units/amount calculation guards (`watchNav > 0`) already handle missing NAV
- Backfill pipeline untouched

### Implementation Detail

```tsx
{/* NAV section */}
{editTransaction ? (
  // Existing editable NAV FormField — unchanged
  <FormField name="nav_at_trade" ... />
) : (
  // Read-only NAV status block
  <div className="space-y-2">
    <Label className="text-sm font-medium">NAV at Trade</Label>
    {navLoading || isResolving ? (
      <p className="text-sm text-muted-foreground">Looking up NAV…</p>
    ) : nav !== null ? (
      <div>
        <p className="text-sm font-mono tabular-nums">{nav.toFixed(4)}</p>
        {!isExactMatch && navDateUsed && (
          <p className="text-xs text-amber-600">Using latest available NAV from {navDateUsed}</p>
        )}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground italic">
        Historical NAV will be fetched automatically after saving.
      </p>
    )}
  </div>
)}
```




# Improve Dashboard Metric Labels & UX

## Single file change: `src/components/dashboard/StatCards.tsx`

### Rename labels & reorder
- "Gain / Loss" → **"Unrealized Gain"**
- "Return" → **"Investor Return (MWR)"**
- "Total Return (TWR)" → **"Portfolio Return (TWR)"**
- Order: Total Value → Total Cost → Unrealized Gain → Investor Return (MWR) → Portfolio Return (TWR)

### Add helper text (two return cards only)
- MWR: "Your personal return based on money invested."
- TWR: "Performance independent of deposits or withdrawals."
- Rendered as `text-[10px] text-muted-foreground mt-1`

### Add info icon tooltips (two return cards only)
- Import `Info` from lucide-react, `Tooltip` components from `@/components/ui/tooltip`
- 12px `Info` icon beside label, `cursor-help`
- MWR tooltip: "Return on your invested capital based on how much you put in."
- TWR tooltip: "Portfolio performance excluding the impact of cash flows."

### Prevent label wrapping
- Add `whitespace-nowrap` to label `<p>` element
- Add `shrink-0` to icon elements

### Implementation
- Extend stats array items with optional `helperText?: string` and `tooltip?: string` fields
- Wrap card grid in `<TooltipProvider>`
- Conditionally render helper text and tooltip based on field presence
- No changes to props, calculations, or other files


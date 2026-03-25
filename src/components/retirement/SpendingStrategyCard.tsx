import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { SimulationInput, SpendingMode, ValidationErrors } from "@/lib/retirement-simulation";

interface SpendingStrategyCardProps {
  input: SimulationInput;
  errors: ValidationErrors;
  balanceAtRetirement: number | null;
  onChange: (field: keyof SimulationInput, value: number) => void;
  onSpendingModeChange: (mode: SpendingMode) => void;
  onToggleInflation: (value: boolean) => void;
}

const WITHDRAWAL_PRESETS = [
  { label: "Conservative", rate: 3.0 },
  { label: "Balanced", rate: 3.5 },
  { label: "Standard", rate: 4.0 },
];

function FieldRow({ label, value, error, onChange, suffix }: {
  label: string;
  value: number;
  error?: string;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={error ? "border-destructive" : ""}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const fmt = (v: number) => `฿${Math.max(0, Math.round(v)).toLocaleString("th-TH")}`;

export function SpendingStrategyCard({
  input,
  errors,
  balanceAtRetirement,
  onChange,
  onSpendingModeChange,
  onToggleInflation,
}: SpendingStrategyCardProps) {
  const isManual = input.spendingMode === "manual";

  const canPreview = !isManual && balanceAtRetirement !== null && balanceAtRetirement > 0;
  const previewAnnual = canPreview ? balanceAtRetirement! * (input.withdrawalRate / 100) : null;
  const previewMonthly = previewAnnual !== null ? previewAnnual / 12 : null;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Spending Strategy</CardTitle>
        <CardDescription>Choose how retirement spending should be determined.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ToggleGroup
          type="single"
          value={input.spendingMode}
          onValueChange={(v) => {
            if (v) onSpendingModeChange(v as SpendingMode);
          }}
          className="w-full"
        >
          <ToggleGroupItem value="manual" className="flex-1 text-sm">Manual Spending</ToggleGroupItem>
          <ToggleGroupItem value="withdrawal-rate" className="flex-1 text-sm">Withdrawal Rate Rule</ToggleGroupItem>
        </ToggleGroup>

        {isManual && (
          <div className="space-y-4">
            <FieldRow
              label="Monthly Spending (Retirement)"
              value={input.retirementMonthlySpending}
              error={errors.retirementMonthlySpending}
              onChange={(v) => onChange("retirementMonthlySpending", v)}
            />
          </div>
        )}

        {!isManual && (
          <div className="space-y-4">
            <FieldRow
              label="Withdrawal Rate"
              value={input.withdrawalRate}
              error={errors.withdrawalRate}
              onChange={(v) => onChange("withdrawalRate", v)}
              suffix="%"
            />

            <div className="flex gap-2">
              {WITHDRAWAL_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant={input.withdrawalRate === preset.rate ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => onChange("withdrawalRate", preset.rate)}
                >
                  {preset.label} {preset.rate}%
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              The standard 4% option follows the common 4% rule: first-year spending is set at 4% of retirement balance, then can increase over time with inflation.
            </p>

            <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Estimated First-Year Spending</p>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Annual</span>
                <span className="text-sm font-semibold text-foreground">
                  {previewAnnual !== null ? fmt(previewAnnual) : "—"}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Monthly</span>
                <span className="text-sm font-semibold text-foreground">
                  {previewMonthly !== null ? fmt(previewMonthly) : "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-border pt-4 space-y-4">
          <FieldRow
            label="Inflation Rate"
            value={input.inflationRate}
            error={errors.inflationRate}
            onChange={(v) => onChange("inflationRate", v)}
            suffix="%"
          />
          <div className="flex items-center gap-3">
            <Switch
              checked={input.applyInflationToRetirementSpending}
              onCheckedChange={onToggleInflation}
            />
            <div>
              <Label className="text-sm font-medium text-foreground">Apply to spending</Label>
              <p className="text-xs text-muted-foreground">Increase retirement spending each year after retirement.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

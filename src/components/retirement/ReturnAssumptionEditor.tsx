import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { ReturnRange, ReturnMode, ValidationErrors, ValidationWarnings } from "@/lib/retirement-simulation";
import { resolveReturnForAge, type SimulationInput } from "@/lib/retirement-simulation";
import { RETURN_PRESETS as PRESETS } from "@/lib/retirement-presets";

interface ReturnAssumptionEditorProps {
  input: SimulationInput;
  errors: ValidationErrors;
  warnings: ValidationWarnings;
  onModeChange: (mode: ReturnMode) => void;
  onAnnualReturnChange: (value: number) => void;
  onReturnRangesChange: (ranges: ReturnRange[]) => void;
}

export function ReturnAssumptionEditor({
  input,
  errors,
  warnings,
  onModeChange,
  onAnnualReturnChange,
  onReturnRangesChange,
}: ReturnAssumptionEditorProps) {
  const { returnMode, annualReturn, returnRanges } = input;
  const rangeErrors = errors.returnRanges || {};

  const modes: { value: ReturnMode; label: string; disabled?: boolean }[] = [
    { value: "fixed", label: "Fixed Return" },
    { value: "age-based", label: "Age-Based Return" },
    { value: "portfolio", label: "From Portfolio", disabled: true },
  ];

  const updateRange = (index: number, field: keyof ReturnRange, value: number) => {
    const updated = returnRanges.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onReturnRangesChange(updated);
  };

  const addRange = () => {
    const lastEnd = returnRanges.length > 0 ? returnRanges[returnRanges.length - 1].endAge + 1 : 25;
    onReturnRangesChange([...returnRanges, { startAge: lastEnd, endAge: lastEnd + 9, annualReturn: 6.0 }]);
  };

  const removeRange = (index: number) => {
    onReturnRangesChange(returnRanges.filter((_, i) => i !== index));
  };

  const sampleAges = [35, 52, 67].filter((a) => a >= (input.savingsRanges[0]?.startAge ?? 30) && a <= input.targetAge);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Return Assumption</CardTitle>
        <CardDescription>Choose how annual return should be modeled in the simulation.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
          {modes.map((m) => (
            <button
              key={m.value}
              disabled={m.disabled}
              onClick={() => onModeChange(m.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                returnMode === m.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              } ${m.disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {m.label}
              {m.disabled && <span className="ml-1 text-xs">(Soon)</span>}
            </button>
          ))}
        </div>

        {returnMode === "fixed" && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Use one return assumption across the whole simulation.</p>
            <Label className="text-sm font-medium text-foreground">Annual Return (%)</Label>
            <div className="relative max-w-xs">
              <Input
                type="number"
                value={annualReturn}
                onChange={(e) => onAnnualReturnChange(Number(e.target.value))}
                className={errors.annualReturn ? "border-destructive" : ""}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
            </div>
            {errors.annualReturn && <p className="text-xs text-destructive">{errors.annualReturn}</p>}
          </div>
        )}

        {returnMode === "age-based" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Set different return assumptions for different age ranges.</p>

            <div className="flex gap-2">
              {Object.entries(PRESETS).map(([key, preset]) => (
                <Button
                  key={key}
                  variant="outline"
                  size="sm"
                  onClick={() => onReturnRangesChange(preset.ranges)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {returnRanges.map((range, i) => {
              const re = rangeErrors[i] || {};
              return (
                <div key={i} className="space-y-1">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">From age</span>
                      <Input
                        type="number"
                        value={range.startAge}
                        onChange={(e) => updateRange(i, "startAge", Number(e.target.value))}
                        className={`h-9 ${re.startAge ? "border-destructive" : ""}`}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">To age</span>
                      <Input
                        type="number"
                        value={range.endAge}
                        onChange={(e) => updateRange(i, "endAge", Number(e.target.value))}
                        className={`h-9 ${re.endAge ? "border-destructive" : ""}`}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <span className="text-xs text-muted-foreground">Expected return (%)</span>
                      <Input
                        type="number"
                        value={range.annualReturn}
                        onChange={(e) => updateRange(i, "annualReturn", Number(e.target.value))}
                        className={`h-9 ${re.annualReturn ? "border-destructive" : ""}`}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRange(i)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {(re.startAge || re.endAge || re.annualReturn || re.overlap) && (
                    <p className="text-xs text-destructive">{re.overlap || re.startAge || re.endAge || re.annualReturn}</p>
                  )}
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addRange} className="w-full">
              <Plus className="mr-1 h-4 w-4" /> Add Range
            </Button>

            {warnings.returnRangeCoverage && (
              <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertDescription className="text-sm text-orange-700 dark:text-orange-300">
                  {warnings.returnRangeCoverage}
                </AlertDescription>
              </Alert>
            )}

            {returnRanges.length > 0 && sampleAges.length > 0 && (
              <div className="rounded-md border border-border bg-muted/50 px-3 py-2">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-foreground">
                  {sampleAges.map((age) => (
                    <span key={age}>
                      Age {age} → {(resolveReturnForAge(age, input) * 100).toFixed(1)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {returnMode === "portfolio" && (
          <p className="text-sm text-muted-foreground">
            Use portfolio allocation by age to derive return assumptions. Coming soon.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

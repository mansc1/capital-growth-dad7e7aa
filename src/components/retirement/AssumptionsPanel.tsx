import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SimulationInput, ValidationErrors } from "@/lib/retirement-simulation";

interface AssumptionsPanelProps {
  input: SimulationInput;
  errors: ValidationErrors;
  onChange: (field: keyof SimulationInput, value: number) => void;
}

function FieldRow({ label, value, error, onChange }: {
  label: string;
  value: number;
  error?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={error ? "border-destructive" : ""}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function AssumptionsPanel({ input, errors, onChange }: AssumptionsPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Assumptions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <FieldRow label="Birth Year" value={input.birthYear} error={errors.birthYear} onChange={(v) => onChange("birthYear", v)} />
        <FieldRow label="Retirement Age" value={input.retirementAge} error={errors.retirementAge} onChange={(v) => onChange("retirementAge", v)} />
        <FieldRow label="Target Age" value={input.targetAge} error={errors.targetAge} onChange={(v) => onChange("targetAge", v)} />
      </CardContent>
    </Card>
  );
}

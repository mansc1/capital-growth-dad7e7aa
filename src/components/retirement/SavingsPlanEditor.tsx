import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import type { SavingsRange, ValidationErrors } from "@/lib/retirement-simulation";

interface SavingsPlanEditorProps {
  ranges: SavingsRange[];
  errors: ValidationErrors;
  onUpdate: (ranges: SavingsRange[]) => void;
}

export function SavingsPlanEditor({ ranges, errors, onUpdate }: SavingsPlanEditorProps) {
  const rangeErrors = errors.savingsRanges || {};

  const updateRange = (index: number, field: keyof SavingsRange, value: number) => {
    const updated = ranges.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    onUpdate(updated);
  };

  const addRange = () => {
    const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1].endAge + 1 : 25;
    onUpdate([...ranges, { startAge: lastEnd, endAge: lastEnd + 9, monthlySavings: 5000 }]);
  };

  const removeRange = (index: number) => {
    onUpdate(ranges.filter((_, i) => i !== index));
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Savings Plan</CardTitle>
        <CardDescription>You can set different monthly savings amounts for different age ranges.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ranges.map((range, i) => {
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
                  <span className="text-xs text-muted-foreground">Monthly savings</span>
                  <Input
                    type="number"
                    value={range.monthlySavings}
                    onChange={(e) => updateRange(i, "monthlySavings", Number(e.target.value))}
                    className={`h-9 ${re.monthlySavings ? "border-destructive" : ""}`}
                  />
                </div>
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeRange(i)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {(re.startAge || re.endAge || re.monthlySavings || re.overlap) && (
                <p className="text-xs text-destructive">{re.overlap || re.startAge || re.endAge || re.monthlySavings}</p>
              )}
            </div>
          );
        })}
        <Button variant="outline" size="sm" onClick={addRange} className="w-full">
          <Plus className="mr-1 h-4 w-4" /> Add Range
        </Button>
      </CardContent>
    </Card>
  );
}

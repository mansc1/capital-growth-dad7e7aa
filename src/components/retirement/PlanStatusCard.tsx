import { format } from "date-fns";
import { CheckCircle2, FileEdit, History, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SavedRetirementPlan } from "@/lib/retirement-plan-storage";
import type { SimulationInput } from "@/lib/retirement-simulation";
import { isSamePlanInput } from "@/lib/retirement-plan-storage";

interface PlanStatusCardProps {
  input: SimulationInput;
  activePlan: SavedRetirementPlan | null;
  history: SavedRetirementPlan[];
  onConfirm: () => void;
  onLoadPlan: (plan: SavedRetirementPlan) => void;
}

export function PlanStatusCard({
  input,
  activePlan,
  history,
  onConfirm,
  onLoadPlan,
}: PlanStatusCardProps) {
  const isActive = activePlan !== null && isSamePlanInput(input, activePlan.input);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Status + Action */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            {isActive ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Using your active plan
                </span>
              </>
            ) : (
              <>
                <FileEdit className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium text-muted-foreground">
                  Draft plan
                </span>
              </>
            )}
          </div>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isActive}
          >
            Set as My Plan
          </Button>
        </div>

        {/* Plan History */}
        {history.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <History className="h-3.5 w-3.5" />
              Plan History
            </div>
            <div className="space-y-1.5">
              {history.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 truncate text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {format(new Date(plan.savedAt), "d MMM yyyy, HH:mm")}
                    </span>
                    {" · "}
                    Retire at {plan.input.retirementAge} • Target {plan.input.targetAge}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs shrink-0"
                    onClick={() => onLoadPlan(plan)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Load
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

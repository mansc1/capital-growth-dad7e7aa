import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { RetirementChart } from "./RetirementChart";
import type { ComparisonScenario } from "./RetirementChart";
import { SummaryMetrics } from "./SummaryMetrics";
import { Settings2, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import type { SimulationResult, SpendingMode, ReturnMode } from "@/lib/retirement-simulation";

interface ProjectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseResult: SimulationResult;
  comparisonResults?: ComparisonScenario[];
  retirementAge: number;
  targetAge: number;
  inflationRate: number;
  applyInflation: boolean;
  spendingMode: SpendingMode;
  withdrawalRate: number;
  comparisonMode: boolean;
  onToggleComparison: (v: boolean) => void;
  annualReturn: number;
  returnMode: ReturnMode;
}

function scrollToSection(id: string, onClose: () => void) {
  onClose();
  setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 350);
}

export function ProjectionSheet({
  open,
  onOpenChange,
  baseResult,
  comparisonResults,
  retirementAge,
  targetAge,
  comparisonMode,
  onToggleComparison,
  annualReturn,
  returnMode,
  inflationRate,
  applyInflation,
  spendingMode,
  withdrawalRate,
}: ProjectionSheetProps) {
  const close = () => onOpenChange(false);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-0">
          <DrawerTitle>Retirement Projection</DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4 space-y-4">
          <RetirementChart
            baseResult={baseResult}
            comparisonResults={comparisonResults}
            retirementAge={retirementAge}
            targetAge={targetAge}
            comparisonMode={comparisonMode}
            onToggleComparison={onToggleComparison}
            annualReturn={annualReturn}
            returnMode={returnMode}
          />
          <SummaryMetrics
            result={baseResult}
            inflationRate={inflationRate}
            applyInflation={applyInflation}
            spendingMode={spendingMode}
            withdrawalRate={withdrawalRate}
          />
        </div>

        <DrawerFooter className="flex-row gap-1.5 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs px-2"
            onClick={() => scrollToSection("section-assumptions", close)}
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Assumptions
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs px-2"
            onClick={() => scrollToSection("section-savings", close)}
          >
            <PiggyBank className="mr-1 h-3.5 w-3.5" />
            Savings
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs px-2"
            onClick={() => scrollToSection("section-returns", close)}
          >
            <TrendingUp className="mr-1 h-3.5 w-3.5" />
            Returns
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs px-2"
            onClick={() => scrollToSection("section-spending", close)}
          >
            <Wallet className="mr-1 h-3.5 w-3.5" />
            Spending
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

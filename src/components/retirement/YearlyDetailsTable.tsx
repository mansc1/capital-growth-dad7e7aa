import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { YearlyRow } from "@/lib/retirement-simulation";

interface YearlyDetailsTableProps {
  rows: YearlyRow[];
}

const fmt = (v: number) => `฿${Math.max(0, Math.round(v)).toLocaleString("th-TH")}`;

export function YearlyDetailsTable({ rows }: YearlyDetailsTableProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between px-6 py-4 h-auto">
            <span className="text-lg font-semibold text-foreground">Yearly Details</span>
            {open ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <div className="max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky top-0 bg-card">Age</TableHead>
                    <TableHead className="sticky top-0 bg-card">Phase</TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">Monthly Savings</TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">Annual Savings</TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">Annual Withdrawal</TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">Interest Earned</TableHead>
                    <TableHead className="sticky top-0 bg-card text-right">End Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.age} className={!row.isPositive ? "text-destructive" : ""}>
                      <TableCell className="font-medium">{row.age}</TableCell>
                      <TableCell className="capitalize text-xs">{row.phase}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.monthlySavings > 0 ? fmt(row.monthlySavings) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.annualSavings > 0 ? fmt(row.annualSavings) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.annualWithdrawal > 0 ? fmt(row.annualWithdrawal) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmt(row.annualInterest)}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{fmt(row.endBalance)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

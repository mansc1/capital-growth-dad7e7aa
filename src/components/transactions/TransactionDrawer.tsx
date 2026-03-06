import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useFunds } from "@/hooks/use-funds";
import { useNavLookup } from "@/hooks/use-nav-history";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { useHoldings } from "@/hooks/use-holdings";
import { getCurrentUnits } from "@/lib/holdings";
import { supabase } from "@/integrations/supabase/client";
import type { TransactionWithFund, TxType, DividendType } from "@/types/portfolio";

const txTypes: { value: TxType; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "dividend", label: "Dividend" },
  { value: "switch_in", label: "Switch In" },
  { value: "switch_out", label: "Switch Out" },
];

const baseSchema = z.object({
  fund_id: z.string().min(1, "Select a fund"),
  tx_type: z.enum(["buy", "sell", "dividend", "switch_in", "switch_out"]),
  trade_date: z.string().min(1, "Required"),
  units: z.number().min(0.0001, "Must be positive"),
  amount: z.number().min(0, "Must be non-negative"),
  nav_at_trade: z.number().min(0.0001, "Must be positive"),
  fee: z.number().min(0, "Cannot be negative"),
  note: z.string().optional(),
  dividend_type: z.enum(["cash", "reinvest"]).nullable().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editTransaction?: TransactionWithFund | null;
}

export function TransactionDrawer({ open, onClose, editTransaction }: Props) {
  const { data: funds } = useFunds();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const [navNotFound, setNavNotFound] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      fund_id: "",
      tx_type: "buy",
      trade_date: new Date().toISOString().split("T")[0],
      units: 0,
      amount: 0,
      nav_at_trade: 0,
      fee: 0,
      note: "",
      dividend_type: null,
    },
  });

  const watchTxType = form.watch("tx_type");
  const watchFundId = form.watch("fund_id");
  const watchDate = form.watch("trade_date");
  const watchNav = form.watch("nav_at_trade");
  const watchAmount = form.watch("amount");
  const watchUnits = form.watch("units");

  const isBuyType = watchTxType === "buy" || watchTxType === "switch_in";
  const isSellType = watchTxType === "sell" || watchTxType === "switch_out";
  const isDividend = watchTxType === "dividend";

  // NAV auto-fill
  const { data: navLookup } = useNavLookup(watchFundId, watchDate);

  useEffect(() => {
    if (navLookup !== undefined && navLookup !== null) {
      form.setValue("nav_at_trade", Number(navLookup));
      setNavNotFound(false);
    } else if (watchFundId && watchDate && navLookup === null) {
      setNavNotFound(true);
    }
  }, [navLookup, watchFundId, watchDate]);

  // Auto-compute units or amount
  useEffect(() => {
    if (watchNav > 0) {
      if (isBuyType && watchAmount > 0) {
        form.setValue("units", Number((watchAmount / watchNav).toFixed(4)));
      }
      if (isSellType && watchUnits > 0) {
        form.setValue("amount", Number((watchUnits * watchNav).toFixed(2)));
      }
      if (isDividend) {
        const dt = form.getValues("dividend_type");
        if (dt === "reinvest" && watchAmount > 0) {
          form.setValue("units", Number((watchAmount / watchNav).toFixed(4)));
        }
      }
    }
  }, [watchNav, watchAmount, watchUnits, watchTxType]);

  // Populate form for editing
  useEffect(() => {
    if (editTransaction) {
      form.reset({
        fund_id: editTransaction.fund_id,
        tx_type: editTransaction.tx_type,
        trade_date: editTransaction.trade_date,
        units: Number(editTransaction.units),
        amount: Number(editTransaction.amount),
        nav_at_trade: Number(editTransaction.nav_at_trade),
        fee: Number(editTransaction.fee),
        note: editTransaction.note ?? "",
        dividend_type: editTransaction.dividend_type,
      });
    } else {
      form.reset({
        fund_id: "",
        tx_type: "buy",
        trade_date: new Date().toISOString().split("T")[0],
        units: 0,
        amount: 0,
        nav_at_trade: 0,
        fee: 0,
        note: "",
        dividend_type: null,
      });
    }
  }, [editTransaction, open]);

  // Get current units for sell validation
  const [currentUnits, setCurrentUnits] = useState<number>(0);
  useEffect(() => {
    if (isSellType && watchFundId) {
      supabase
        .from("transactions")
        .select("fund_id, tx_type, units, dividend_type, trade_date")
        .eq("fund_id", watchFundId)
        .order("trade_date")
        .then(({ data }) => {
          if (data) {
            const txs = data.map((t) => ({
              ...t,
              units: Number(t.units),
              tx_type: t.tx_type as string,
              dividend_type: t.dividend_type as string | null,
            }));
            let total = 0;
            for (const tx of txs) {
              if (tx.tx_type === "buy" || tx.tx_type === "switch_in") total += tx.units;
              else if (tx.tx_type === "sell" || tx.tx_type === "switch_out") total -= tx.units;
              else if (tx.tx_type === "dividend" && tx.dividend_type === "reinvest") total += tx.units;
            }
            setCurrentUnits(Math.max(0, total));
          }
        });
    }
  }, [isSellType, watchFundId]);

  async function onSubmit(values: FormValues) {
    // Validate sell doesn't exceed holdings
    if (isSellType && values.units > currentUnits) {
      form.setError("units", { message: `Cannot sell more than ${currentUnits.toFixed(4)} units held` });
      return;
    }

    const payload = {
      fund_id: values.fund_id,
      tx_type: values.tx_type as TxType,
      trade_date: values.trade_date,
      units: values.units,
      amount: values.amount,
      nav_at_trade: values.nav_at_trade,
      fee: values.fee,
      note: values.note || null,
      dividend_type: isDividend ? (values.dividend_type as DividendType) : null,
    };

    if (editTransaction) {
      await updateMutation.mutateAsync({ id: editTransaction.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editTransaction ? "Edit Transaction" : "Add Transaction"}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField
              control={form.control}
              name="tx_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={(v) => {
                    field.onChange(v);
                    if (v === "dividend") form.setValue("dividend_type", "cash");
                    else form.setValue("dividend_type", null);
                  }}>
                    <FormControl>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {txTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fund_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select fund" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {funds?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.fund_code} — {f.fund_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trade_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {navNotFound && (
              <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  NAV not found for this date. Please enter manually.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="nav_at_trade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NAV at Trade {!navNotFound && watchFundId && watchDate ? "(auto-filled)" : ""}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isDividend && (
              <div className="flex items-center gap-3">
                <Label className="text-sm">Dividend Type</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Cash</span>
                  <Switch
                    checked={form.watch("dividend_type") === "reinvest"}
                    onCheckedChange={(checked) =>
                      form.setValue("dividend_type", checked ? "reinvest" : "cash")
                    }
                  />
                  <span className="text-xs text-muted-foreground">Reinvest</span>
                </div>
              </div>
            )}

            {(isBuyType || isDividend) && (
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (THB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isSellType && (
              <>
                <FormField
                  control={form.control}
                  name="units"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Units to Sell (max: {currentUnits.toFixed(4)})</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.0001"
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="text-xs text-muted-foreground">
                  Computed amount: ฿{(watchUnits * watchNav).toFixed(2)}
                </div>
              </>
            )}

            {(isBuyType || (isDividend && form.watch("dividend_type") === "reinvest")) && (
              <div className="text-xs text-muted-foreground">
                Computed units: {watchNav > 0 ? (watchAmount / watchNav).toFixed(4) : "—"}
              </div>
            )}

            <FormField
              control={form.control}
              name="fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fee (THB)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editTransaction ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

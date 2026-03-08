import { useEffect, useRef, useState } from "react";
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
import { X } from "lucide-react";
import { toast } from "sonner";
import { useActiveFunds } from "@/hooks/use-active-funds";
import { useEnsureFund } from "@/hooks/use-ensure-fund";
import { useNavForTradeDate } from "@/hooks/use-nav-for-trade-date";
import { useResolveFundIdBySecCode } from "@/hooks/use-resolve-fund-id-by-sec-code";
import { useCreateTransaction, useUpdateTransaction } from "@/hooks/use-transactions";
import { SecFundSearchPopover } from "@/components/funds/SecFundSearchPopover";
import { supabase } from "@/integrations/supabase/client";
import type { TransactionWithFund, TxType, DividendType } from "@/types/portfolio";
import type { SecFundResult } from "@/hooks/use-sec-fund-search";

const txTypes: { value: TxType; label: string }[] = [
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "dividend", label: "Dividend" },
  { value: "switch_in", label: "Switch In" },
  { value: "switch_out", label: "Switch Out" },
];

const baseSchema = z.object({
  fund_id: z.string(),
  tx_type: z.enum(["buy", "sell", "dividend", "switch_in", "switch_out"]),
  trade_date: z.string().min(1, "Required"),
  units: z.number().min(0.0001, "Must be positive"),
  amount: z.number().min(0, "Must be non-negative"),
  // 0 = pending historical NAV backfill placeholder, not a real NAV value.
  // It satisfies the DB NOT NULL constraint while background backfill resolves the real NAV.
  nav_at_trade: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return 0;
      const num = Number(val);
      return Number.isNaN(num) ? 0 : num;
    },
    z.number().min(0)
  ),
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
  const { data: funds } = useActiveFunds();
  const { mutateAsync: ensureFund, isPending: isEnsuring } = useEnsureFund();
  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const [newFundLabel, setNewFundLabel] = useState<string | null>(null);
  const [pendingSecFund, setPendingSecFund] = useState<SecFundResult | null>(null);
  const [navManuallyEdited, setNavManuallyEdited] = useState(false);
  const prevFundId = useRef<string>("");
  const prevDate = useRef<string>("");
  const isEditInitialLoad = useRef(false);
  const prevSecCode = useRef<string>("");
  const navWasAutoFilled = useRef(false);

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
  const pendingSecCode = pendingSecFund?.proj_abbr_name?.trim().toUpperCase() ?? "";

  // --- State reset helpers ---
  function resetPendingState() {
    setPendingSecFund(null);
    setNewFundLabel(null);
    setNavManuallyEdited(false);
    isEditInitialLoad.current = false;
    navWasAutoFilled.current = false;
    prevFundId.current = "";
    prevDate.current = "";
    prevSecCode.current = "";
  }

  function handleClose() {
    resetPendingState();
    onClose();
  }

  function clearPendingFund() {
    setPendingSecFund(null);
    setNewFundLabel(null);
    form.setValue("fund_id", "");
    form.clearErrors("fund_id");
  }

  // Clear newFundLabel when the fund appears in the dropdown
  useEffect(() => {
    if (newFundLabel && funds?.find((f) => f.id === watchFundId)) {
      setNewFundLabel(null);
    }
  }, [funds, watchFundId, newFundLabel]);

  // Track actual fund/date/secCode value changes to reset manual override
  useEffect(() => {
    const fundChanged = watchFundId !== prevFundId.current;
    const dateChanged = watchDate !== prevDate.current;
    const secCodeChanged = pendingSecCode !== prevSecCode.current;

    if (fundChanged || dateChanged || secCodeChanged) {
      if (prevFundId.current || prevDate.current || prevSecCode.current) {
        setNavManuallyEdited(false);
        isEditInitialLoad.current = false;
      }
      prevFundId.current = watchFundId;
      prevDate.current = watchDate;
      prevSecCode.current = pendingSecCode;
    }
  }, [watchFundId, watchDate, pendingSecCode]);

  // NAV lookup — resolve pending fund's sec_fund_code to an existing fund_id for autofill
  const { resolvedFundId, isResolving } = useResolveFundIdBySecCode(
    pendingSecFund ? pendingSecFund.proj_abbr_name : undefined
  );
  const navFundId = pendingSecFund ? resolvedFundId : watchFundId;
  const { nav, navDateUsed, isExactMatch, isLoading: navLoading } = useNavForTradeDate(navFundId, watchDate);

  // NAV autofill effect
  useEffect(() => {
    if (navManuallyEdited || isEditInitialLoad.current) return;

    if (nav !== null) {
      const currentNav = form.getValues("nav_at_trade");
      if (currentNav !== nav) {
        form.setValue("nav_at_trade", nav);
        navWasAutoFilled.current = true;
      }
  } else {
    // No NAV available — use 0 as pending backfill placeholder and clear validation errors
    form.setValue("nav_at_trade", 0);
    form.clearErrors("nav_at_trade");
    navWasAutoFilled.current = false;
  }
  }, [nav, navManuallyEdited, form]);

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
      setPendingSecFund(null);
      setNewFundLabel(null);
      setNavManuallyEdited(false);
      isEditInitialLoad.current = true;
      navWasAutoFilled.current = false;
      prevFundId.current = editTransaction.fund_id;
      prevDate.current = editTransaction.trade_date;
    } else {
      const defaultDate = new Date().toISOString().split("T")[0];
      form.reset({
        fund_id: "",
        tx_type: "buy",
        trade_date: defaultDate,
        units: 0,
        amount: 0,
        nav_at_trade: 0,
        fee: 0,
        note: "",
        dividend_type: null,
      });
      setPendingSecFund(null);
      setNewFundLabel(null);
      setNavManuallyEdited(false);
      isEditInitialLoad.current = false;
      navWasAutoFilled.current = false;
      prevFundId.current = "";
      prevDate.current = defaultDate;
    }
  }, [editTransaction, open]);

  // Get current units for sell validation — skip when pending fund
  const [currentUnits, setCurrentUnits] = useState<number>(0);
  useEffect(() => {
    if (isSellType && watchFundId && !pendingSecFund) {
      supabase
        .from("transactions")
        .select("fund_id, tx_type, units, dividend_type, trade_date")
        .eq("fund_id", watchFundId)
        .order("trade_date")
        .then(({ data }) => {
          if (data) {
            let total = 0;
            for (const tx of data) {
              const u = Number(tx.units);
              if (tx.tx_type === "buy" || tx.tx_type === "switch_in") total += u;
              else if (tx.tx_type === "sell" || tx.tx_type === "switch_out") total -= u;
              else if (tx.tx_type === "dividend" && tx.dividend_type === "reinvest") total += u;
            }
            setCurrentUnits(Math.max(0, total));
          }
        });
    }
  }, [isSellType, watchFundId, pendingSecFund]);

  function handleSecFundSelect(result: SecFundResult) {
    const norm = result.proj_abbr_name.trim().toUpperCase();
    // Check if this fund already exists in the active list
    const existing = funds?.find((f) => {
      const secCode = f.sec_fund_code?.trim().toUpperCase();
      const fundCode = f.fund_code.trim().toUpperCase();
      return secCode === norm || fundCode === norm;
    });

    if (existing) {
      form.setValue("fund_id", existing.id);
      setPendingSecFund(null);
      setNewFundLabel(null);
      form.clearErrors("fund_id");
    } else {
      setPendingSecFund(result);
      setNewFundLabel(result.proj_abbr_name);
      form.setValue("fund_id", "");
      form.clearErrors("fund_id");
    }
  }

  async function onSubmit(values: FormValues) {
    // Submit-time fund validation
    if (!values.fund_id && !pendingSecFund) {
      form.setError("fund_id", { message: "Select a fund" });
      return;
    }

    // Sell validation — skip when pending (new fund has no units)
    if (isSellType && !pendingSecFund && values.units > currentUnits) {
      form.setError("units", { message: `Cannot sell more than ${currentUnits.toFixed(4)} units held` });
      return;
    }

    let fundId = values.fund_id;

    // Deferred fund creation
    if (pendingSecFund) {
      try {
        fundId = await ensureFund(pendingSecFund);
      } catch {
        // ensureFund hook shows its own error toast
        return;
      }
    }

    const payload = {
      fund_id: fundId,
      tx_type: values.tx_type as TxType,
      trade_date: values.trade_date,
      units: values.units,
      amount: values.amount,
      nav_at_trade: values.nav_at_trade,
      fee: values.fee,
      note: values.note || null,
      dividend_type: isDividend ? (values.dividend_type as DividendType) : null,
    };

    try {
      let result;
      if (editTransaction) {
        result = await updateMutation.mutateAsync({ id: editTransaction.id, ...payload });
      } else {
        result = await createMutation.mutateAsync(payload);
      }
      if (result?.backfillEnqueued) {
        toast.success("Transaction saved. Historical NAV is being updated in the background.");
      } else {
        toast.success(editTransaction ? "Transaction updated." : "Transaction saved.");
      }
      resetPendingState();
      onClose();
    } catch (err) {
      // Fund was created but transaction save failed — transition to normal selected-fund state
      if (pendingSecFund || newFundLabel) {
        form.setValue("fund_id", fundId);
        setPendingSecFund(null);
        setNewFundLabel(null);
        form.clearErrors("fund_id");
        toast.error("Fund was created but transaction save failed. You can retry.");
      }
    }
  }

  // Determine the display value for the fund selector
  const selectedFundInList = funds?.find((f) => f.id === watchFundId);
  const fundDisplayValue = selectedFundInList
    ? watchFundId
    : newFundLabel
      ? watchFundId
      : "";

  // NAV helper text
  function renderNavHelper() {
    // Loading takes precedence — prevents flash of "No NAV found" messages
    if ((navLoading || isResolving) && (navFundId || pendingSecFund) && watchDate) {
      return <p className="text-xs text-muted-foreground">Looking up NAV…</p>;
    }
    if (!navLoading && nav !== null && isExactMatch && !navManuallyEdited) {
      return <p className="text-xs text-muted-foreground">NAV auto-filled from {navDateUsed}</p>;
    }
    if (!navLoading && nav !== null && !isExactMatch && !navManuallyEdited) {
      return (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Using latest available NAV from {navDateUsed} (trade date: {watchDate})
        </p>
      );
    }
    // resolvedFundId exists but no nav_history entry found
    if (!navLoading && nav === null && navFundId && watchDate) {
      return (
        <p className="text-xs text-muted-foreground">
          {editTransaction
            ? "NAV for this date is not available yet. Saving will trigger an automatic historical NAV update."
            : "No NAV found for this date. Save the transaction and historical NAV will be fetched automatically."}
        </p>
      );
    }
    // Pending SEC fund with no matching fund in DB at all
    if (pendingSecFund && !resolvedFundId && !isResolving) {
      return (
        <p className="text-xs text-muted-foreground">
          No NAV found for this date. Save the transaction and historical NAV will be fetched automatically.
        </p>
      );
    }
    return null;
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Fund</FormLabel>
                    {!pendingSecFund && (
                      <SecFundSearchPopover onSelect={handleSecFundSelect} />
                    )}
                  </div>

                  {pendingSecFund ? (
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div>
                        <span className="text-sm font-medium">{pendingSecFund.proj_abbr_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">(new — will be created on save)</span>
                      </div>
                      <button
                        type="button"
                        onClick={clearPendingFund}
                        className="text-muted-foreground hover:text-foreground ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Select
                      value={fundDisplayValue}
                      onValueChange={(v) => {
                        field.onChange(v);
                        setPendingSecFund(null);
                        setNewFundLabel(null);
                        form.clearErrors("fund_id");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger disabled={isEnsuring}>
                          <SelectValue placeholder={isEnsuring ? "Adding fund…" : "Select fund"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {newFundLabel && !selectedFundInList && watchFundId && (
                          <SelectItem value={watchFundId}>
                            {newFundLabel} (just added)
                          </SelectItem>
                        )}
                        {funds?.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.fund_code} — {f.fund_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
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

            <FormField
              control={form.control}
              name="nav_at_trade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NAV at Trade</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0001"
                      {...field}
                      onChange={(e) => {
                        field.onChange(Number(e.target.value));
                        setNavManuallyEdited(true);
                        navWasAutoFilled.current = false;
                      }}
                    />
                  </FormControl>
                  {renderNavHelper()}
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
                      <FormLabel>
                        Units to Sell
                        {!pendingSecFund && ` (max: ${currentUnits.toFixed(4)})`}
                      </FormLabel>
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
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={isSubmitting || isEnsuring}
              >
                {isEnsuring && pendingSecFund
                  ? "Creating fund…"
                  : editTransaction
                    ? "Update"
                    : "Add"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCreateFund, useUpdateFund } from "@/hooks/use-fund-mutations";
import type { Fund } from "@/types/portfolio";

const fundSchema = z.object({
  fund_code: z.string().min(1, "Fund code is required"),
  sec_fund_code: z.string().optional(),
  fund_name: z.string().min(1, "Fund name is required"),
  amc_name: z.string().min(1, "AMC name is required"),
  category: z.string().optional(),
  asset_class: z.string().optional(),
  risk_level: z.union([z.number().int().min(1).max(8), z.nan()]).optional().nullable(),
  currency: z.string().min(1),
});

type FormValues = z.infer<typeof fundSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  editFund?: Fund | null;
}

export function FundDrawer({ open, onClose, editFund }: Props) {
  const createMutation = useCreateFund();
  const updateMutation = useUpdateFund();
  const [hasHistory, setHasHistory] = useState(false);
  const [codeChanged, setCodeChanged] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(fundSchema),
    defaultValues: {
      fund_code: "",
      sec_fund_code: "",
      fund_name: "",
      amc_name: "",
      category: "",
      asset_class: "",
      risk_level: null,
      currency: "THB",
    },
  });

  const watchFundCode = form.watch("fund_code");

  // Check if editing fund has historical records
  useEffect(() => {
    if (editFund) {
      form.reset({
        fund_code: editFund.fund_code,
        sec_fund_code: editFund.sec_fund_code ?? "",
        fund_name: editFund.fund_name,
        amc_name: editFund.amc_name,
        category: editFund.category ?? "",
        asset_class: editFund.asset_class ?? "",
        risk_level: editFund.risk_level,
        currency: editFund.currency,
      });
      setCodeChanged(false);

      // Check for transactions or nav_history
      Promise.all([
        supabase.from("transactions").select("id", { count: "exact", head: true }).eq("fund_id", editFund.id),
        supabase.from("nav_history").select("id", { count: "exact", head: true }).eq("fund_id", editFund.id),
      ]).then(([txRes, navRes]) => {
        setHasHistory(((txRes.count ?? 0) + (navRes.count ?? 0)) > 0);
      });
    } else {
      form.reset({
        fund_code: "",
        sec_fund_code: "",
        fund_name: "",
        amc_name: "",
        category: "",
        asset_class: "",
        risk_level: null,
        currency: "THB",
      });
      setHasHistory(false);
      setCodeChanged(false);
    }
  }, [editFund, open]);

  // Track fund_code changes for warning
  useEffect(() => {
    if (editFund && watchFundCode !== editFund.fund_code) {
      setCodeChanged(true);
    } else {
      setCodeChanged(false);
    }
  }, [watchFundCode, editFund]);

  async function onSubmit(values: FormValues) {
    // Check duplicate fund_code
    const { data: existing } = await supabase
      .from("funds")
      .select("id")
      .eq("fund_code", values.fund_code)
      .maybeSingle();

    if (existing && existing.id !== editFund?.id) {
      form.setError("fund_code", { message: "This fund code already exists" });
      return;
    }

    const payload = {
      fund_code: values.fund_code,
      fund_name: values.fund_name,
      amc_name: values.amc_name,
      sec_fund_code: values.sec_fund_code || null,
      category: values.category || null,
      asset_class: values.asset_class || null,
      risk_level: values.risk_level && !isNaN(values.risk_level) ? values.risk_level : null,
      currency: values.currency,
    };

    if (editFund) {
      await updateMutation.mutateAsync({ id: editFund.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editFund ? "Edit Fund" : "Add Fund"}</SheetTitle>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            <FormField
              control={form.control}
              name="fund_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Code *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. KFAFIX-A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {hasHistory && codeChanged && (
              <Alert className="border-yellow-500/50 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Changing the fund code will update how this fund appears across the app. Historical records will remain linked.
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="sec_fund_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SEC Fund Code (for NAV sync)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. KFAFIX-A" {...field} />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Used only for SEC Thailand NAV API lookups. Leave blank to use the fund code above.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fund_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Krungsri Fixed Income Fund" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amc_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AMC Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Krungsri Asset Management" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Fixed Income" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="asset_class"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Class</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Bond" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="risk_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Risk Level (1–8)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      placeholder="e.g. 4"
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? null : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input placeholder="THB" {...field} />
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
                {editFund ? "Update" : "Add Fund"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

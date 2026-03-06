import { useState, useCallback, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, Download, CheckCircle2, AlertTriangle, XCircle, Copy, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { parseCsvFile, downloadCsvTemplate } from '@/lib/csv/parse-csv';
import { APP_FIELDS, autoDetectMapping } from '@/lib/csv/column-mapping';
import { validateRows, type ValidatedRow, type RowStatus } from '@/lib/csv/validate-row';
import { useTransactions } from '@/hooks/use-transactions';
import { useActiveFunds } from '@/hooks/use-active-funds';
import { useImportTransactions } from '@/hooks/use-import-transactions';
import { toast } from 'sonner';

interface ImportCsvDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const STEP_LABELS = ['Upload', 'Mapping', 'Preview', 'Confirm', 'Done'];

const STATUS_CONFIG: Record<RowStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  valid: { label: 'Valid', className: 'bg-gain-muted text-gain', icon: CheckCircle2 },
  warning: { label: 'Warning', className: 'bg-accent text-accent-foreground', icon: AlertTriangle },
  invalid: { label: 'Invalid', className: 'bg-loss-muted text-loss', icon: XCircle },
  duplicate: { label: 'Duplicate', className: 'bg-muted text-muted-foreground', icon: Copy },
};

export function ImportCsvDialog({ open, onClose }: ImportCsvDialogProps) {
  const [step, setStep] = useState<Step>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [filterStatus, setFilterStatus] = useState<RowStatus | 'all'>('all');
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existingTransactions } = useTransactions();
  const { data: existingFunds } = useActiveFunds();
  const importMutation = useImportTransactions();
  const [importResult, setImportResult] = useState<{ imported: number; fundsCreated: number; failed: number; warnings: string[] } | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setHeaders([]);
    setRawRows([]);
    setFileName('');
    setMapping({});
    setValidatedRows([]);
    setFilterStatus('all');
    setIsValidating(false);
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Step 1: File handling
  const handleFile = useCallback(async (file: File) => {
    try {
      const result = await parseCsvFile(file);
      setHeaders(result.headers);
      setRawRows(result.rows);
      setFileName(file.name);
      const autoMap = autoDetectMapping(result.headers);
      setMapping(autoMap);
      setStep(2);
    } catch {
      toast.error('Failed to parse CSV file');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) handleFile(file);
    else toast.error('Please drop a .csv file');
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Step 2: Mapping validation
  const requiredMapped = useMemo(() => {
    return APP_FIELDS.filter((f) => f.required).every((f) => mapping[f.key]);
  }, [mapping]);

  // Step 3: Run validation
  const runValidation = useCallback(async () => {
    setIsValidating(true);
    // Small delay to show loading state
    await new Promise((r) => setTimeout(r, 50));
    const results = validateRows(rawRows, mapping, existingFunds ?? [], existingTransactions ?? []);
    setValidatedRows(results);
    setIsValidating(false);
    setStep(3);
  }, [rawRows, mapping, existingFunds, existingTransactions]);

  // Counts
  const counts = useMemo(() => {
    const c = { valid: 0, warning: 0, invalid: 0, duplicate: 0, total: validatedRows.length };
    for (const r of validatedRows) c[r.status]++;
    return c;
  }, [validatedRows]);

  const importableRows = useMemo(
    () => validatedRows.filter((r) => r.status === 'valid' || r.status === 'warning'),
    [validatedRows],
  );

  const filteredRows = useMemo(() => {
    if (filterStatus === 'all') return validatedRows;
    return validatedRows.filter((r) => r.status === filterStatus);
  }, [validatedRows, filterStatus]);

  const unresolvedFundCount = useMemo(
    () => importableRows.filter((r) => !r.resolvedFundId).length,
    [importableRows],
  );

  // Step 4: Import
  const handleImport = useCallback(async () => {
    try {
      const result = await importMutation.mutateAsync(importableRows);
      setImportResult(result);
      setStep(5);
      if (result.imported > 0) toast.success(`${result.imported} transactions imported`);
      if (result.failed > 0) toast.error(`${result.failed} transactions failed`);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    }
  }, [importMutation, importableRows]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Transactions from CSV</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-1">
              {i > 0 && <div className="w-4 h-px bg-border" />}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${
                i + 1 === step ? 'text-primary' : i + 1 < step ? 'text-muted-foreground' : 'text-muted-foreground/50'
              }`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  i + 1 === step ? 'bg-primary text-primary-foreground' : i + 1 < step ? 'bg-muted text-muted-foreground' : 'bg-muted/50 text-muted-foreground/50'
                }`}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                <span className="hidden sm:inline">{label}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="flex-1 flex flex-col gap-4">
            <div
              className="flex-1 min-h-[200px] border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium">Drop a CSV file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Accepts .csv files only</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileInput} />
            </div>
            <Button variant="outline" size="sm" className="self-start" onClick={downloadCsvTemplate}>
              <Download className="h-4 w-4 mr-1" /> Download Template
            </Button>
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === 2 && (
          <div className="flex-1 flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              File: <strong>{fileName}</strong> ({rawRows.length} rows). Map CSV columns to fields:
            </p>
            <ScrollArea className="flex-1 max-h-[400px]">
              <div className="space-y-3 pr-4">
                {APP_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <label className="w-36 text-sm font-medium shrink-0">
                      {field.label}{field.required && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    <Select
                      value={mapping[field.key] || '__unmapped__'}
                      onValueChange={(v) =>
                        setMapping((m) => {
                          const next = { ...m };
                          if (v === '__unmapped__') delete next[field.key];
                          else next[field.key] = v;
                          return next;
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Unmapped" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unmapped__">Unmapped</SelectItem>
                        {headers.map((h) => (
                          <SelectItem key={h} value={h}>{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="sm" disabled={!requiredMapped} onClick={runValidation}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Validation Preview */}
        {step === 3 && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            {isValidating ? (
              <div className="flex-1 flex items-center justify-center">
                <Skeleton className="h-[300px] w-full" />
              </div>
            ) : (
              <>
                {/* Summary bar */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium">{counts.total} rows:</span>
                  <span className="text-gain">{counts.valid} valid</span>
                  <span>·</span>
                  <span className="text-accent-foreground">{counts.warning} warnings</span>
                  <span>·</span>
                  <span className="text-loss">{counts.invalid} invalid</span>
                  <span>·</span>
                  <span className="text-muted-foreground">{counts.duplicate} duplicates</span>
                </div>

                {/* SEC directory warning */}
                {unresolvedFundCount > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {unresolvedFundCount} row(s) have unresolved fund codes. These will be looked up in the SEC Fund Directory during import. If the directory is empty or stale, consider refreshing it in Settings first.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Filter tabs */}
                <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2 h-6">All ({counts.total})</TabsTrigger>
                    <TabsTrigger value="valid" className="text-xs px-2 h-6">Valid ({counts.valid})</TabsTrigger>
                    <TabsTrigger value="warning" className="text-xs px-2 h-6">Warning ({counts.warning})</TabsTrigger>
                    <TabsTrigger value="invalid" className="text-xs px-2 h-6">Invalid ({counts.invalid})</TabsTrigger>
                    <TabsTrigger value="duplicate" className="text-xs px-2 h-6">Duplicate ({counts.duplicate})</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Table */}
                <ScrollArea className="flex-1 min-h-0 max-h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead>Fund</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Issues</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((row) => {
                        const cfg = STATUS_CONFIG[row.status];
                        const Icon = cfg.icon;
                        return (
                          <TableRow key={row.rowIndex}>
                            <TableCell className="text-xs text-muted-foreground">{row.rowIndex + 1}</TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                                <Icon className="h-3 w-3" />{cfg.label}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium">{row.rawFundCode || '—'}</TableCell>
                            <TableCell className="text-xs">{row.parsed?.tx_type ?? '—'}</TableCell>
                            <TableCell className="text-xs">{row.parsed?.trade_date ?? '—'}</TableCell>
                            <TableCell className="text-xs text-right tabular-nums">{row.parsed?.amount != null ? row.parsed.amount.toLocaleString() : '—'}</TableCell>
                            <TableCell className="text-xs max-w-[200px]">
                              {[...row.errors, ...row.warnings].map((msg, i) => (
                                <p key={i} className={row.errors.includes(msg) ? 'text-loss' : 'text-accent-foreground'}>{msg}</p>
                              ))}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="sm" disabled={importableRows.length === 0} onClick={() => setStep(4)}>
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 4 && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="border rounded-lg p-4 space-y-2">
              <h3 className="text-sm font-semibold">Import Summary</h3>
              <div className="text-sm space-y-1">
                <p><strong>{importableRows.length}</strong> transactions to import ({counts.valid} valid, {counts.warning} with warnings)</p>
                <p className="text-muted-foreground"><strong>{counts.invalid + counts.duplicate}</strong> rows will be skipped ({counts.invalid} invalid, {counts.duplicate} duplicates)</p>
                {unresolvedFundCount > 0 && (
                  <p className="text-accent-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    <strong>{unresolvedFundCount}</strong> new fund(s) will be created from SEC directory
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" size="sm" onClick={() => setStep(3)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button size="sm" onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Import Transactions
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && importResult && (
          <div className="flex-1 flex flex-col gap-4">
            <div className="border rounded-lg p-6 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-gain" />
              <h3 className="text-lg font-semibold">Import Complete</h3>
              <div className="text-sm space-y-1">
                <p><strong>{importResult.imported}</strong> transactions imported successfully</p>
                {importResult.fundsCreated > 0 && <p><strong>{importResult.fundsCreated}</strong> new fund(s) created</p>}
                {importResult.failed > 0 && <p className="text-loss"><strong>{importResult.failed}</strong> transactions failed to import</p>}
                {(counts.invalid + counts.duplicate) > 0 && (
                  <p className="text-muted-foreground"><strong>{counts.invalid + counts.duplicate}</strong> rows skipped</p>
                )}
              </div>
              {importResult.warnings.length > 0 && (
                <div className="text-left mt-3 border rounded p-3 bg-muted/50">
                  <p className="text-xs font-medium mb-1">Warnings:</p>
                  {importResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{w}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

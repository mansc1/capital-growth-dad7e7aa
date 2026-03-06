import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fundName: string;
  hasActiveHoldings: boolean;
}

export function ArchiveConfirmDialog({ open, onClose, onConfirm, fundName, hasActiveHoldings }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive "{fundName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasActiveHoldings ? (
              <div className="space-y-3">
                <Alert variant="destructive" className="border-yellow-500/50 bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    This fund currently has active holdings in your portfolio. Archiving it will hide it from new transactions and NAV syncs, but existing holdings will remain.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              "Archive this fund? It will remain in historical records but will no longer be active for new syncs or selection."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

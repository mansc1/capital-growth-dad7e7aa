import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SecConnectivityResult {
  reachable: boolean;
  error?: string;
  category?: string;
}

export function useSecConnectivity() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SecConnectivityResult | null>(null);

  const check = useCallback(async (): Promise<SecConnectivityResult | null> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-sec-connectivity");
      if (error) {
        console.error("[check-sec-connectivity] invoke error:", error);
        return null;
      }
      const r = data as SecConnectivityResult;
      setResult(r);
      return r;
    } catch (err) {
      console.error("[check-sec-connectivity] exception:", err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { check, result, isLoading };
}

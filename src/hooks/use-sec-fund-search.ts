import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SecFundResult {
  proj_id: string;
  proj_abbr_name: string;
  proj_name_en: string | null;
  proj_name_th: string | null;
  amc_name: string | null;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSecFundSearch(query: string) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ["sec-fund-search", debouncedQuery],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("search-sec-funds", {
        body: { query: debouncedQuery },
      });
      if (error) throw error;
      return (data?.results ?? []) as SecFundResult[];
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
  });
}

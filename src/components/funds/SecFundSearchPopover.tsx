import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { useSecFundSearch, type SecFundResult } from "@/hooks/use-sec-fund-search";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  onSelect: (result: SecFundResult) => void;
}

export function SecFundSearchPopover({ onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: results, isLoading, isFetching } = useSecFundSearch(query);

  const handleSelect = (result: SecFundResult) => {
    onSelect(result);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5">
          <Search className="h-3.5 w-3.5" />
          Search SEC
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-3 border-b">
          <Input
            placeholder="Search by fund name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <ScrollArea className="max-h-64">
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Searching…
            </div>
          ) : query.length < 2 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Type at least 2 characters to search
            </p>
          ) : results && results.length > 0 ? (
            <div className="py-1">
              {results.map((r) => (
                <button
                  key={r.proj_id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                  onClick={() => handleSelect(r)}
                >
                  <div className="font-medium">{r.proj_abbr_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.proj_name_en || r.proj_name_th}
                    {r.amc_name && ` · ${r.amc_name}`}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">
              No funds found. Try refreshing the SEC directory first.
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

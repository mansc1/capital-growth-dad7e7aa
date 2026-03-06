import type { NavProvider, NavResult } from "../types.ts";

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const THROTTLE_DELAY_MS = 200;

/**
 * Maps internal fund_code to the code used by SEC API.
 * Currently an identity function — extend later if funds
 * store a separate `sec_fund_code` column.
 */
function getFundLookupCode(fundCode: string): string {
  return fundCode;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Retry on 429 or 5xx
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
          console.warn(`[SEC] HTTP ${res.status} for ${url}, retrying in ${wait}ms…`);
          await delay(wait);
          continue;
        }
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastError = err as Error;

      if (attempt < retries) {
        const wait = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(`[SEC] Network error for ${url}, retrying in ${wait}ms: ${lastError.message}`);
        await delay(wait);
        continue;
      }
    }
  }

  throw lastError ?? new Error(`fetchWithRetry failed for ${url}`);
}

export class SecThNavProvider implements NavProvider {
  private apiKey: string;

  constructor() {
    const key = Deno.env.get("SEC_API_KEY") ?? "";
    if (!key) {
      throw new Error(
        "SEC_API_KEY is not configured. Set the SEC_API_KEY secret to enable the SEC Thailand NAV provider.",
      );
    }
    this.apiKey = key;
  }

  async fetchLatestNavForFund(fundCode: string): Promise<NavResult | null> {
    const lookupCode = getFundLookupCode(fundCode);

    try {
      const url = `https://api.sec.or.th/FundFactsheet/fund/daily?fund_code=${encodeURIComponent(lookupCode)}`;
      const res = await fetchWithRetry(url, {
        "Ocp-Apim-Subscription-Key": this.apiKey,
        Accept: "application/json",
      });

      if (!res.ok) {
        console.error(`[SEC] HTTP ${res.status} for ${fundCode}`);
        return null;
      }

      const data = await res.json();

      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`[SEC] Empty or non-array response for ${fundCode}`);
        return null;
      }

      // Sort descending by nav_date to get latest
      data.sort((a: any, b: any) => {
        const dateA = a.nav_date ?? "";
        const dateB = b.nav_date ?? "";
        return dateB.localeCompare(dateA);
      });

      const latest = data[0];
      const rawDate = latest.nav_date ?? "";
      const navDate = rawDate.substring(0, 10); // Normalize to YYYY-MM-DD
      const navPerUnit = parseFloat(latest.last_val);

      if (!navDate || !/^\d{4}-\d{2}-\d{2}$/.test(navDate)) {
        console.warn(`[SEC] Invalid nav_date "${rawDate}" for ${fundCode}`);
        return null;
      }

      if (isNaN(navPerUnit) || navPerUnit <= 0) {
        console.warn(`[SEC] Invalid last_val "${latest.last_val}" for ${fundCode}`);
        return null;
      }

      return {
        fundCode,
        navDate,
        navPerUnit,
        source: "sec_th",
      };
    } catch (err) {
      console.error(`[SEC] Error fetching ${fundCode}:`, err);
      return null;
    }
  }

  async fetchLatestNavForFunds(fundCodes: string[]): Promise<NavResult[]> {
    const results: NavResult[] = [];
    for (let i = 0; i < fundCodes.length; i++) {
      const result = await this.fetchLatestNavForFund(fundCodes[i]);
      if (result) results.push(result);

      // Throttle between requests (skip after last)
      if (i < fundCodes.length - 1) {
        await delay(THROTTLE_DELAY_MS);
      }
    }
    return results;
  }
}

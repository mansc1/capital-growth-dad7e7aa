import type { NavProvider, NavResult } from "../types.ts";

const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const THROTTLE_DELAY_MS = 200;

const NORM = (s: string): string => s.trim().toUpperCase();

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

/** NAV field candidates in priority order */
const NAV_FIELD_CANDIDATES = ["last_val", "nav", "net_asset"] as const;

/**
 * Parse the SEC Daily NAV API response.
 * Handles both object and array response shapes.
 * Returns the NAV value or null if unparseable.
 */
function parseDailyNavResponse(
  data: unknown,
  fundCode: string,
  projId: string,
  dateStr: string,
): number | null {
  if (data == null) {
    console.warn(`[SEC] Null response for ${fundCode} proj_id=${projId} date=${dateStr}`);
    return null;
  }

  // Normalize: if array, take first element
  let record: Record<string, unknown>;
  if (Array.isArray(data)) {
    if (data.length === 0) {
      console.warn(`[SEC] Empty array response for ${fundCode} proj_id=${projId} date=${dateStr}`);
      return null;
    }
    record = data[0] as Record<string, unknown>;
  } else if (typeof data === "object") {
    record = data as Record<string, unknown>;
  } else {
    console.warn(`[SEC] Unexpected response type (${typeof data}) for ${fundCode} proj_id=${projId} date=${dateStr}`);
    return null;
  }

  // Try each candidate field
  for (const field of NAV_FIELD_CANDIDATES) {
    const raw = record[field];
    if (raw !== undefined && raw !== null) {
      const val = parseFloat(String(raw));
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }

  // None of the expected fields found — log keys once
  console.warn(
    `[SEC] Unexpected response shape for ${fundCode} proj_id=${projId} date=${dateStr}: keys=${Object.keys(record).join(",")}`
  );
  return null;
}

/**
 * SEC Thailand NAV Provider
 *
 * Uses the Fund Daily Info API to fetch daily NAV by proj_id.
 * proj_id resolution is handled externally via the injected projIdMap
 * (sourced from sec_fund_directory).
 */
export class SecThNavProvider implements NavProvider {
  private dailyApiKey: string;

  constructor() {
    // Prefer SEC_DAILY_API_KEY; fall back to SEC_API_KEY
    const dailyKey = Deno.env.get("SEC_DAILY_API_KEY") ?? "";
    const fallbackKey = Deno.env.get("SEC_API_KEY") ?? "";

    if (dailyKey) {
      this.dailyApiKey = dailyKey;
      console.log("[SEC] Using SEC_DAILY_API_KEY");
    } else if (fallbackKey) {
      this.dailyApiKey = fallbackKey;
      console.log("[SEC] Using SEC_API_KEY as fallback for Daily NAV");
    } else {
      throw new Error(
        "Neither SEC_DAILY_API_KEY nor SEC_API_KEY is configured. Set at least one to enable the SEC Thailand NAV provider.",
      );
    }
  }

  async fetchLatestNavForFund(fundCode: string, projId?: string): Promise<NavResult | null> {
    if (!projId) {
      console.warn(`[SEC] No projId provided for ${fundCode} — skipping`);
      return null;
    }

    console.log(`[SEC] Fund ${fundCode} → proj_id ${projId}`);

    try {
      const today = new Date();
      for (let daysBack = 0; daysBack < 5; daysBack++) {
        const date = new Date(today);
        date.setDate(date.getDate() - daysBack);
        const dateStr = date.toISOString().substring(0, 10);

        const url = `https://api.sec.or.th/FundDailyInfo/${projId}/dailynav/${dateStr}`;
        const res = await fetchWithRetry(url, {
          "Ocp-Apim-Subscription-Key": this.dailyApiKey,
          Accept: "application/json",
        });

        // 204 = no data for this date (holiday/weekend)
        if (res.status === 204) {
          await res.text(); // consume body
          await delay(THROTTLE_DELAY_MS);
          continue;
        }

        // Log non-204 responses with details
        console.log(`[SEC] ${fundCode} proj_id=${projId} date=${dateStr} → HTTP ${res.status}`);

        if (!res.ok) {
          await res.text(); // consume body
          if (res.status === 401) {
            console.error(`[SEC] 401 on FundDailyInfo — ensure your API key is subscribed to "Fund Daily Info" product`);
            return null;
          }
          await delay(THROTTLE_DELAY_MS);
          continue;
        }

        const data = await res.json();
        const navPerUnit = parseDailyNavResponse(data, fundCode, projId, dateStr);

        if (navPerUnit === null) {
          continue;
        }

        return {
          fundCode,
          navDate: dateStr,
          navPerUnit,
          source: "sec_th",
        };
      }

      console.warn(`[SEC] No NAV data found for ${fundCode} (proj_id=${projId}) in last 5 days`);
      return null;
    } catch (err) {
      console.error(`[SEC] Error fetching ${fundCode} (proj_id=${projId}):`, err);
      return null;
    }
  }

  async fetchLatestNavForFunds(fundCodes: string[], projIdMap?: Map<string, string>): Promise<NavResult[]> {
    if (!projIdMap || projIdMap.size === 0) {
      throw new Error("projIdMap is required for SEC provider — ensure sec_fund_directory is populated");
    }

    const results: NavResult[] = [];
    for (let i = 0; i < fundCodes.length; i++) {
      const code = fundCodes[i];
      const projId = projIdMap.get(NORM(code));

      if (!projId) {
        console.warn(`[SEC] No proj_id in map for ${code} — skipping`);
        continue;
      }

      const result = await this.fetchLatestNavForFund(code, projId);
      if (result) results.push(result);

      if (i < fundCodes.length - 1) {
        await delay(THROTTLE_DELAY_MS);
      }
    }
    return results;
  }
}

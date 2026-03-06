export interface NavResult {
  fundCode: string;
  navDate: string; // YYYY-MM-DD
  navPerUnit: number;
  source: string;
}

export interface NavProvider {
  fetchLatestNavForFund(fundCode: string, projId?: string): Promise<NavResult | null>;
  fetchLatestNavForFunds(fundCodes: string[], projIdMap?: Map<string, string>): Promise<NavResult[]>;
}

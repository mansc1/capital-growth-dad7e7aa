/**
 * Paginated loader for sec_fund_directory.
 *
 * The table contains 14k+ rows which exceeds Supabase's default 1,000-row
 * query limit. This helper pages through the full table and returns a
 * normalised Map<UPPER_ABBR_NAME, proj_id>.
 */

const PAGE_SIZE = 1000;

export async function loadFullSecDirectory(
  supabase: { from: (table: string) => any },
  callerTag = "nav",
): Promise<Map<string, string>> {
  const projIdMap = new Map<string, string>();
  let totalRows = 0;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sec_fund_directory")
      .select("proj_id, proj_abbr_name")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`[${callerTag}] Failed to query sec_fund_directory at offset ${offset}: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    totalRows += data.length;

    for (const entry of data) {
      if (entry.proj_abbr_name && entry.proj_id) {
        projIdMap.set(entry.proj_abbr_name.trim().toUpperCase(), entry.proj_id);
      }
    }

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(
    `[${callerTag}] Loaded ${totalRows} sec_fund_directory rows → ${projIdMap.size} normalised map entries`,
  );

  return projIdMap;
}

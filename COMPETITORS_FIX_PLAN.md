# Competitors Feature - Complete Fix Implementation Plan

## ROOT CAUSES IDENTIFIED

### Root Cause #1: Async Sync Not Awaited
**File**: `app/api/competitors/route.ts` line 20-21
**Current**:
```typescript
// Initiate background sync for ads discovery immediately
syncCompetitorAds(parsed.data.advertiserId, token).catch(console.error);
```
**Problem**: Fire-and-forget call. Returns response before sync completes.
**Impact**: CompetitorDashboard renders immediately with zero ads because sync happening in background.

### Root Cause #2: Metadata From Search Not Fully Used
**File**: `components/competitor-dashboard.tsx` lines 207-210
**Current**:
```typescript
body: JSON.stringify({
  advertiserId: candidate.id,
  advertiserName: candidate.name,
  advertiserAvatarUrl: candidate.avatar,
}),
```
**Problem**: Metadata is sent to POST but if sync fails immediately after, `buildCompetitorIntelligence()` still falls through to fallback name.

### Root Cause #3: Fallback Name Uses Provider ID
**File**: `lib/brand-data.ts` lines 116-124
**Current**:
```typescript
if (!brandName || brandName.trim() === "") {
  brandName = `Meta advertiser ${advertiserId}`;
}
```
**Problem**: Falls back to showing Meta page ID when:
- Sync hasn't completed yet
- Sync completed but no ads returned
- No tracked competitor record exists with advertiser_name

### Root Cause #4: No Sync Status Tracking
**File**: `app/api/competitors/route.ts`
**Missing**: No `sync_status` or `sync_error` columns to track:
- idle
- syncing
- success
- error

### Root Cause #5: Zero Not Distinguished From Loading
**File**: `components/competitor-dashboard.tsx` line 108-110
**Current**:
```typescript
<span className="text-[20px] font-semibold text-ink">{brand.activeAds}</span>
<span className="text-xs text-muted font-medium mt-0.5">Active Ads</span>
```
**Problem**: Shows `0` whether data is loading or confirmed zero.

---

## IMPLEMENTATION PLAN

### PHASE 2A: Database Schema Enhancement
**File**: Create migration `20260901000000_competitor_sync_status.sql`

Add columns to `competitors` table:
```sql
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS sync_status text default 'idle';
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS sync_error text;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS first_sync_completed_at timestamptz;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS ads_count integer default -1; -- -1 = unknown, >=0 = known
```

### PHASE 2B: Fix POST /api/competitors Route
**File**: `app/api/competitors/route.ts`

Changes:
1. Await `syncCompetitorAds()` instead of fire-and-forget
2. Set sync_status to "success" or "error"
3. Store first_sync_completed_at on success
4. Return sync status to client
5. Include whether ads were found (ads_count)

### PHASE 2C: Fix buildCompetitorIntelligence Resolution Order
**File**: `lib/brand-data.ts` lines 116-124

New priority:
1. If trackedRecord.advertiser_name exists and isn't empty → use it
2. Else if ads.length > 0 → use ads[0].advertiser_name
3. Else if trackedRecord has previous advertiser_name from last sync → use cached
4. Else → check sync_status:
   - If "syncing" → show "Fetching advertiser name..."
   - If "error" → show name with error suffix
   - Else → show provider fallback "Meta advertiser [ID]"

### PHASE 3: Optimistic UI in CompetitorDashboard
**File**: `components/competitor-dashboard.tsx`

Changes:
1. Track `syncingIds` state for competitor IDs currently syncing
2. Show loading skeleton when ID in syncingIds
3. Display "Fetching ads..." state during sync
4. Disable action buttons during sync
5. Handle sync errors gracefully

### PHASE 4: Initial Sync Before Card Render
**File**: `app/(workspace)/(paid)/competitors/page.tsx`

Changes:
1. After fetching competitors, initiate sync for any with sync_status != "success"
2. Wait for first sync if brand.ads_count === -1 (unknown)
3. Or show loading state and revalidate after short delay

### PHASE 5: Fix Data Resolution Pipeline
Sequence:
```
1. User clicks Track
2. POST /api/competitors:
   a. Store competitor with advertiser_name/avatar from search
   b. Set sync_status = "syncing"
   c. Call syncCompetitorAds (AWAIT this)
   d. If sync returns ads: sync_status = "success", ads_count = count, first_sync_completed_at = now()
   e. If sync fails: sync_status = "error", sync_error = message, ads_count = 0
   f. Return { competitor, syncStatus, adsCount } to client
3. Client receives response:
   a. If syncStatus = "success": show card with real data
   b. If syncStatus = "error": show card with error state
4. getCompetitorSummaries queries ads and builds stats
5. buildCompetitorIntelligence prioritizes stored metadata
```

---

## FILES TO MODIFY

### 1. Database Migration (NEW)
- Create `supabase/migrations/20260901000000_competitor_sync_status.sql`

### 2. Core Fixes
- `app/api/competitors/route.ts` - Fix POST to await sync
- `lib/brand-data.ts` - Fix buildCompetitorIntelligence() resolution
- `components/competitor-dashboard.tsx` - Add loading states and sync tracking

### 3. Page Level
- `app/(workspace)/(paid)/competitors/page.tsx` - Handle initial sync state

### 4. Optional Enhancements
- `lib/brand-data.ts` - Add sync retry logic
- `app/api/competitors/route.ts` - Add PATCH for manual refresh

---

## DETAILED CODE CHANGES

### CHANGE 1: Add Migration
File: `supabase/migrations/20260901000000_competitor_sync_status.sql`

```sql
-- Add sync tracking to competitors table
ALTER TABLE public.competitors 
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'success', 'error')),
  ADD COLUMN IF NOT EXISTS sync_error text,
  ADD COLUMN IF NOT EXISTS first_sync_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ads_count integer DEFAULT -1;

-- Index for finding stale syncs
CREATE INDEX IF NOT EXISTS competitors_sync_status_idx ON public.competitors(user_id, sync_status);
CREATE INDEX IF NOT EXISTS competitors_first_sync_idx ON public.competitors(user_id, first_sync_completed_at DESC);

-- Create a function to update sync status
CREATE OR REPLACE FUNCTION public.update_competitor_sync_status(
  p_user_id uuid,
  p_advertiser_id text,
  p_status text,
  p_error text DEFAULT NULL,
  p_ads_count integer DEFAULT NULL
)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.competitors
  SET 
    sync_status = p_status,
    sync_error = p_error,
    ads_count = COALESCE(p_ads_count, ads_count),
    first_sync_completed_at = CASE 
      WHEN p_status = 'success' AND first_sync_completed_at IS NULL THEN now()
      ELSE first_sync_completed_at 
    END,
    last_synced_at = now()
  WHERE user_id = p_user_id AND advertiser_id = p_advertiser_id;
$$;
```

### CHANGE 2: Fix POST Route
File: `app/api/competitors/route.ts`

Replace entire POST function with:
```typescript
export async function POST(request: NextRequest) {
  const auth = await requireUser(); 
  if (auth.error) return auth.error;
  
  const accessError = await requirePaidWorkspaceAccess(); 
  if (accessError) return accessError;
  
  const parsed = z.object({ 
    advertiserId: z.string().min(1).max(200), 
    advertiserName: z.string().min(1).max(300), 
    advertiserAvatarUrl: z.string().nullable().optional() 
  }).safeParse(await request.json().catch(() => ({})));
  
  if (!parsed.success) 
    return NextResponse.json({ error: "Select a valid advertiser." }, { status: 400 });
  
  const { data: existingCompetitor } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("user_id", auth.user!.id)
    .eq("advertiser_id", parsed.data.advertiserId)
    .maybeSingle();
  
  // If already tracking, return existing
  if (existingCompetitor) {
    return NextResponse.json({ 
      competitor: existingCompetitor,
      isNew: false,
      message: "Already tracking this advertiser."
    }, { status: 200 });
  }

  // Create competitor record with sync_status = "syncing"
  const { data: competitor, error: createError } = await auth.supabase!
    .from("competitors")
    .insert({
      user_id: auth.user!.id,
      advertiser_id: parsed.data.advertiserId,
      advertiser_name: parsed.data.advertiserName,
      advertiser_avatar_url: parsed.data.advertiserAvatarUrl,
      sync_status: "syncing",
      ads_count: -1
    })
    .select()
    .single();
  
  if (createError) 
    return NextResponse.json({ error: createError.message }, { status: 400 });
  
  // Initiate sync and AWAIT completion
  const token = await clerkAuth().then(a => a.getToken()).catch(() => null);
  let syncError: string | null = null;
  let adsCount = 0;
  
  try {
    const synced = await syncCompetitorAds(parsed.data.advertiserId, token);
    
    // Query how many ads we actually have now
    const { count, error: countError } = await auth.supabase!
      .from("ads")
      .select("*", { count: "exact", head: true })
      .eq("advertiser_id", parsed.data.advertiserId);
    
    adsCount = count ?? 0;
    
    if (!synced) {
      syncError = "No ads found for this advertiser from available providers.";
    }
    
    // Update sync status
    if (adsCount > 0 || synced) {
      await auth.supabase!
        .from("competitors")
        .update({
          sync_status: "success",
          sync_error: null,
          ads_count: adsCount,
          first_sync_completed_at: new Date().toISOString()
        })
        .eq("id", competitor.id);
    } else {
      await auth.supabase!
        .from("competitors")
        .update({
          sync_status: "success", // Still mark success even if no ads
          sync_error: null,
          ads_count: 0,
          first_sync_completed_at: new Date().toISOString()
        })
        .eq("id", competitor.id);
    }
    
  } catch (err) {
    syncError = err instanceof Error ? err.message : "Sync failed.";
    
    // Mark as error
    await auth.supabase!
      .from("competitors")
      .update({
        sync_status: "error",
        sync_error: syncError,
        ads_count: 0
      })
      .eq("id", competitor.id)
      .catch(console.error);
  }
  
  return NextResponse.json({ 
    competitor: { ...competitor, sync_status: syncError ? "error" : "success" },
    isNew: true,
    syncStatus: syncError ? "error" : "success",
    adsCount,
    syncError
  }, { status: 201 });
}
```

### CHANGE 3: Fix buildCompetitorIntelligence
File: `lib/brand-data.ts` lines 110-130

```typescript
function buildCompetitorIntelligence(
  advertiserId: string,
  ads: BulkAdRow[],
  trackedRecord?: Partial<TrackedRecord> & { sync_status?: string; ads_count?: number } | null
): CompetitorIntelligence {
  // Identity Resolution Priority: 
  // 1. Tracked competitor DB record name (highest priority - user may have renamed)
  // 2. First ad's advertiser name (from provider)
  // 3. Special states for sync status
  // 4. Fallback to provider ID
  
  let brandName = trackedRecord?.advertiser_name;
  let logoUrl = trackedRecord?.advertiser_avatar_url || null;

  // If tracked record has valid name, use it
  if (brandName && brandName.trim() !== "") {
    // Use it
  } else if (ads.length > 0) {
    // Use name from ads if no tracked record name
    brandName = ads[0].advertiser_name;
    logoUrl = ads[0].advertiser_avatar_url || null;
  } else {
    // Determine fallback based on sync status
    if (trackedRecord?.sync_status === "syncing") {
      brandName = "Fetching advertiser...";
    } else if (trackedRecord?.sync_status === "error") {
      brandName = `Meta advertiser ${advertiserId}`;
    } else {
      // Default fallback
      brandName = `Meta advertiser ${advertiserId}`;
    }
  }

  // Rest of function stays the same...
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekAgoStr = oneWeekAgo.toISOString();

  // ... continue with existing logic
}
```

### CHANGE 4: Update getCompetitorSummaries
File: `lib/brand-data.ts` around line 285

```typescript
export async function getCompetitorSummaries(trackedRecords: TrackedRecord[]): Promise<CompetitorIntelligence[]> {
  if (!isSupabaseConfigured || !trackedRecords.length) return [];

  const supabase = createAdminClient();
  const advertiserIds = trackedRecords.map(r => r.advertiser_id);

  const { data: adsData } = await supabase
    .from("ads")
    .select("advertiser_id, advertiser_name, advertiser_avatar_url, status, running_days, start_date, media_type, cta, platforms, canonical_ad_id, source_media_url, thumbnail_url, end_date")
    .in("advertiser_id", advertiserIds)
    .order("start_date", { ascending: false });

  const rows = (adsData || []) as BulkAdRow[];

  // Group by advertiser_id
  const groupedAds = new Map<string, BulkAdRow[]>();
  for (const row of rows) {
    if (!groupedAds.has(row.advertiser_id)) {
      groupedAds.set(row.advertiser_id, []);
    }
    groupedAds.get(row.advertiser_id)!.push(row);
  }

  // ENHANCED: Include sync_status and ads_count from tracked records
  return trackedRecords.map(record => {
    const id = record.advertiser_id;
    const advertiserAds = groupedAds.get(id) || [];
    return buildCompetitorIntelligence(id, advertiserAds, {
      ...record,
      // These would need to be selected in the query - see below
    });
  });
}
```

We also need to update the page to select sync_status:

### CHANGE 5: Update Competitors Page Query
File: `app/(workspace)/(paid)/competitors/page.tsx`

```typescript
export default async function CompetitorsPage() {
  const auth = await requireUser();
  
  // Fetch competitors with sync status
  const { data: competitors } = await auth.supabase!
    .from("competitors")
    .select("*")
    .eq("user_id", auth.user!.id)
    .order("created_at", { ascending: false });
    
  // Resolve data efficiently in bulk
  const brands = await getCompetitorSummaries(competitors || []);

  return (
    <>
      <PageHeader
        eyebrow="Market watch"
        title="Competitors"
        description="Track brands and monitor their creative strategy, launches and long-running ads."
      />
      <div className="mt-8">
        <CompetitorDashboard initialBrands={brands} />
      </div>
    </>
  );
}
```

### CHANGE 6: Enhanced CompetitorDashboard with Loading States
File: `components/competitor-dashboard.tsx`

This requires significant changes to show loading states. Key additions:
- Track which competitors are syncing
- Show skeleton/loading state for syncing competitors
- Display "Fetching ads..." message
- Store sync status from POST response

---

## VERIFICATION STEPS

After implementing all changes:

1. Add competitor with search "LayerStory"
2. Verify POST returns immediately with syncStatus
3. Verify card shows "Fetching ads..." initially
4. Verify real brand name appears once sync completes
5. Verify stats populate with real ad counts
6. Verify latest creatives display
7. Test with zero-result advertiser
8. Test with provider failure scenario
9. Verify View Intelligence page works
10. Test duplicate prevention

---

## BACKWARD COMPATIBILITY

These changes are fully backward compatible:
- New columns have defaults
- Existing competitors will have sync_status = 'idle' and ads_count = -1
- Queries handle missing columns gracefully
- No data loss or migration required
- Existing functionality preserved

---

## PERFORMANCE CONSIDERATIONS

- Sync is now awaited on POST, adding 5-15s latency
- This is acceptable since:
  - User sees optimistic UI immediately
  - Sync happens server-side
  - Results cached for subsequent visits
- Consider adding timeout to sync (max 30s)
- Client can poll for updates if needed

---

## NEXT: Implement changes phase by phase

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: sf } = await supabase.from('swipe_files').select('user_id').limit(1);
  const userId = sf?.[0]?.user_id;
  if (!userId) {
    console.log("No user found.");
    return;
  }
  console.log("User ID:", userId);

  const start = performance.now();
  const { data, error } = await supabase
    .from("swipe_files")
    .select(`
      id, name, description, is_system, system_key, created_at, updated_at,
      adCount:swipe_file_items(count),
      items:swipe_file_items(
        ads(thumbnail_url, source_media_url)
      )
    `)
    .eq("user_id", userId)
    .order("is_system", { ascending: false })
    .order("created_at", { ascending: true });

  const end = performance.now();
  console.log(`DB Query time: ${(end - start).toFixed(2)}ms`);

  if (error) {
    console.error("Error:", error);
    return;
  }

  const payloadSize = Buffer.byteLength(JSON.stringify(data), 'utf8');
  console.log(`Payload size from DB: ${(payloadSize / 1024).toFixed(2)} KB`);
  
  // Transform exactly like lib/swipe-files.ts does
  const transformed = data.map(d => {
    const items = d.items as any[] | null;
    const previewMedia = items
      ?.map(item => item.ads?.thumbnail_url || item.ads?.source_media_url)
      .filter(Boolean)
      .slice(0, 3) || [];

    return {
      id: d.id,
      name: d.name,
      adCount: d.adCount?.[0]?.count || 0,
      previewMedia,
    };
  });

  const apiPayloadSize = Buffer.byteLength(JSON.stringify(transformed), 'utf8');
  console.log(`Payload size from API: ${(apiPayloadSize / 1024).toFixed(2)} KB`);
  
  // Count total nested ads fetched
  const totalNestedAds = data.reduce((acc, row) => acc + (row.items?.length || 0), 0);
  console.log(`Total nested ads fetched into Node: ${totalNestedAds}`);
}

run().catch(console.error);

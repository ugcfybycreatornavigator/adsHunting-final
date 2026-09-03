import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const env = fs.readFileSync(".env.local", "utf8")
  .split("\n")
  .filter(line => line && !line.startsWith("#"))
  .map(line => line.split("="))
  .reduce((acc, [key, ...val]) => {
    if (key) acc[key.trim()] = val.join("=").trim().replace(/^"|"$/g, "");
    return acc;
  }, {});

const supabase = createClient(env["NEXT_PUBLIC_SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"]);

async function run() {
  const { data, error } = await supabase
    .from("shared_ad_links")
    .select(`
      id, owner_user_id, name, message, token_hash, content_type, swipe_file_id, 
      expires_at, revoked_at, visibility, allow_save, allow_download, created_at, updated_at, last_viewed_at,
      items:shared_ad_items(count),
      views:shared_ad_access_events(count)
    `);
    
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("SUCCESS:", data?.length);
  }
}

run();

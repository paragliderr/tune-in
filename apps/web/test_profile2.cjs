const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data } = await supabase.from("profiles").select("*").eq("username", "ayush2").single();
  console.log("profile id:", data?.id);
  const { data: userPosts, error } = await supabase.from("posts").select("*, profiles(*), clubs(*)").eq("user_id", data?.id).order("created_at", { ascending: false });
  console.log("posts error:", error);
  console.log("posts length:", userPosts?.length);
  if (userPosts && userPosts.length > 0) {
     console.log("first post:", JSON.stringify(userPosts[0], null, 2));
  }
}
test();

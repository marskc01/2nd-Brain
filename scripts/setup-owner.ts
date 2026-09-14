import nextEnv from "@next/env";
import { adminDb } from "../src/lib/db";
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.OWNER_USER_ID) {
  console.error(
    "Create the owner in Supabase Authentication → Users first, then set OWNER_USER_ID to its UUID in .env.local.",
  );
  process.exit(2);
}
const db = adminDb();
const { data, error } = await db.auth.admin.getUserById(
  process.env.OWNER_USER_ID,
);
if (error || !data.user) {
  console.error(
    "OWNER_USER_ID does not resolve to an auth user in this project.",
  );
  process.exit(2);
}
const result = await db
  .from("owner_profiles")
  .upsert(
    { id: data.user.id, display_name: "Kaden", instagram_handle: "@kdn_brain" },
    { onConflict: "id", ignoreDuplicates: true },
  );
if (result.error) {
  console.error("Could not create the profile. Apply migrations first.");
  process.exit(2);
}
console.log(
  "Owner profile exists. Existing profile/context preserved. Sign in with the owner email and password. Disable new user signups in Supabase Auth settings.",
);

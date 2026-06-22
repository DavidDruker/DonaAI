import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
export const supabaseDisabled =
  process.env.EXPO_PUBLIC_DISABLE_SUPABASE === "true" ||
  process.env.EXPO_PUBLIC_PORTFOLIO_MODE === "true";

export const supabaseConfigured = hasUsableSupabaseConfig(
  supabaseUrl,
  supabaseAnonKey,
);
export const supabasePublicUrl = supabaseUrl;
export const supabasePublicAnonKey = supabaseAnonKey;

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: AsyncStorage,
      },
    })
  : null;

function hasUsableSupabaseConfig(url, anonKey) {
  const cleanUrl = String(url || "").trim();
  const cleanAnonKey = String(anonKey || "").trim();

  if (supabaseDisabled) {
    return false;
  }

  if (!cleanUrl || !cleanAnonKey) {
    return false;
  }

  return (
    !cleanUrl.includes("your-project-ref") &&
    !cleanAnonKey.includes("your-supabase-anon-key")
  );
}

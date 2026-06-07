import {
  supabaseConfigured,
  supabasePublicAnonKey,
  supabasePublicUrl,
} from "./supabaseClient";

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "";

export async function runConnectionDiagnostics() {
  const checks = [
    await checkBackend(),
    await checkSupabase(),
  ];

  return checks.map((check) => `${check.label}: ${check.detail}`).join("\n");
}

async function checkBackend() {
  if (!backendUrl) {
    return {
      label: "Backend",
      detail: "missing EXPO_PUBLIC_BACKEND_URL",
    };
  }

  try {
    const response = await fetch(`${backendUrl.replace(/\/+$/g, "")}/health`);
    const text = await response.text();

    return {
      label: "Backend",
      detail: response.ok ? `ok ${text}` : `HTTP ${response.status} ${text}`,
    };
  } catch (error) {
    return {
      label: "Backend",
      detail: `failed to reach ${backendUrl}: ${formatError(error)}`,
    };
  }
}

async function checkSupabase() {
  if (!supabaseConfigured) {
    return {
      label: "Supabase",
      detail: "missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY",
    };
  }

  try {
    const response = await fetch(
      `${supabasePublicUrl.replace(/\/+$/g, "")}/auth/v1/health`,
      {
        headers: {
          apikey: supabasePublicAnonKey,
        },
      },
    );
    const text = await response.text();

    return {
      label: "Supabase",
      detail: response.ok ? "ok" : `HTTP ${response.status} ${text}`,
    };
  } catch (error) {
    return {
      label: "Supabase",
      detail: `failed to reach ${supabasePublicUrl}: ${formatError(error)}`,
    };
  }
}

function formatError(error) {
  return String(error?.message || error || "unknown error");
}

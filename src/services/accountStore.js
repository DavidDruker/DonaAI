import { supabase, supabaseConfigured } from "./supabaseClient";

const authRedirectUrl =
  process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  undefined;

export async function getCurrentSession() {
  if (!supabaseConfigured) {
    return {
      session: null,
      error: new Error("Supabase is not configured for the mobile app."),
    };
  }

  const { data, error } = await safeSupabaseCall(
    () => supabase.auth.getSession(),
    "checking the saved login session",
  );

  return {
    session: data?.session || null,
    error,
  };
}

export function onAuthStateChange(callback) {
  if (!supabaseConfigured) {
    return {
      unsubscribe() {},
    };
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return data.subscription;
}

export async function signUpAccount({ email, password, name }) {
  if (!supabaseConfigured) {
    return {
      session: null,
      error: new Error("Supabase is not configured for the mobile app."),
    };
  }

  const { data, error } = await safeSupabaseCall(
    () =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authRedirectUrl,
          data: {
            name,
          },
        },
      }),
    "creating the account",
  );

  if (error) {
    return {
      session: null,
      user: null,
      error,
    };
  }

  if (data.user) {
    const profileResult = await upsertProfile(data.user.id, {
      email,
      name,
    });

    if (profileResult.error) {
      return {
        session: data?.session || null,
        user: data?.user || null,
        error: profileResult.error,
      };
    }
  }

  return {
    session: data?.session || null,
    user: data?.user || null,
    error,
  };
}

export async function signInAccount({ email, password }) {
  if (!supabaseConfigured) {
    return {
      session: null,
      error: new Error("Supabase is not configured for the mobile app."),
    };
  }

  const { data, error } = await safeSupabaseCall(
    () =>
      supabase.auth.signInWithPassword({
        email,
        password,
      }),
    "signing in",
  );

  return {
    session: data?.session || null,
    user: data?.user || null,
    error,
  };
}

export async function signOutAccount() {
  if (!supabaseConfigured) {
    return;
  }

  await safeSupabaseCall(() => supabase.auth.signOut(), "signing out");
}

export async function loadUserPreferences(userId) {
  if (!supabaseConfigured || !userId) {
    return {
      preferences: null,
      error: null,
    };
  }

  const { data, error } = await safeSupabaseCall(
    () =>
      supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle(),
    "loading preferences",
  );

  return {
    preferences: data ? mapPreferenceRow(data) : null,
    error,
  };
}

export async function saveUserPreferences(userId, preferences) {
  if (!supabaseConfigured || !userId) {
    return {
      error: new Error("Supabase is not configured for the mobile app."),
    };
  }

  const { error } = await safeSupabaseCall(
    () =>
      supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          preferred_name: preferences.name,
          tone: preferences.tone,
          email_formality: preferences.emailFormality,
          email_length: preferences.emailLength,
          default_meeting_minutes: Number(preferences.defaultMeetingMinutes) || 30,
          email_signoff: preferences.emailSignoff,
          email_draft_mode: preferences.emailDraftMode || "preview",
          additional_instructions: preferences.additionalInstructions,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      ),
    "saving preferences",
  );

  return {
    error,
  };
}

async function upsertProfile(userId, profile) {
  const { error } = await safeSupabaseCall(
    () =>
      supabase.from("profiles").upsert(
        {
          id: userId,
          email: profile.email,
          name: profile.name,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        },
      ),
    "saving the profile",
  );

  return {
    error,
  };
}

function mapPreferenceRow(row) {
  return {
    name: row.preferred_name || "",
    tone: row.tone || "",
    emailFormality: row.email_formality || "Professional",
    emailLength: row.email_length || "Medium",
    defaultMeetingMinutes: String(row.default_meeting_minutes || 30),
    emailSignoff: row.email_signoff || "",
    emailDraftMode: row.email_draft_mode || "preview",
    additionalInstructions: row.additional_instructions || "",
  };
}

async function safeSupabaseCall(callback, action) {
  try {
    const result = await callback();

    return {
      data: result?.data || null,
      error: result?.error || null,
    };
  } catch (error) {
    return {
      data: null,
      error: new Error(formatSupabaseNetworkError(error, action)),
    };
  }
}

function formatSupabaseNetworkError(error, action) {
  const message = String(error?.message || error || "Unknown error");

  if (/fetch failed|network request failed|load failed/i.test(message)) {
    return `Supabase network request failed while ${action}. Check your phone internet/VPN and EXPO_PUBLIC_SUPABASE_URL.`;
  }

  return message;
}

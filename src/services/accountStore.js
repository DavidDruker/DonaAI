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

  const { data, error } = await supabase.auth.getSession();

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: authRedirectUrl,
      data: {
        name,
      },
    },
  });

  if (!error && data.user) {
    await upsertProfile(data.user.id, {
      email,
      name,
    });
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

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

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

  await supabase.auth.signOut();
}

export async function loadUserPreferences(userId) {
  if (!supabaseConfigured || !userId) {
    return {
      preferences: null,
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

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

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      preferred_name: preferences.name,
      tone: preferences.tone,
      working_hours_start: preferences.workingHoursStart,
      working_hours_end: preferences.workingHoursEnd,
      default_meeting_minutes: Number(preferences.defaultMeetingMinutes) || 30,
      email_signoff: preferences.emailSignoff,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    },
  );

  return {
    error,
  };
}

async function upsertProfile(userId, profile) {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: profile.email,
      name: profile.name,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "id",
    },
  );

  return {
    error,
  };
}

function mapPreferenceRow(row) {
  return {
    name: row.preferred_name || "",
    tone: row.tone || "",
    workingHoursStart: row.working_hours_start || "",
    workingHoursEnd: row.working_hours_end || "",
    defaultMeetingMinutes: String(row.default_meeting_minutes || 30),
    emailSignoff: row.email_signoff || "",
  };
}

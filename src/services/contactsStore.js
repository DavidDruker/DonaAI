import { supabase, supabaseConfigured } from "./supabaseClient";

export async function loadContacts(userId) {
  if (!supabaseConfigured || !userId) {
    return {
      contacts: [],
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("contacts")
    .select("id,name,email,notes")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  return {
    contacts: data || [],
    error,
  };
}

export async function saveContact(userId, contact) {
  if (!supabaseConfigured || !userId) {
    return {
      contact: null,
      error: new Error("Supabase is not configured for contacts."),
    };
  }

  const payload = {
    user_id: userId,
    name: contact.name.trim(),
    email: contact.email.trim(),
    notes: contact.notes?.trim() || "",
    updated_at: new Date().toISOString(),
  };

  const query = contact.id
    ? supabase.from("contacts").update(payload).eq("id", contact.id).select().single()
    : supabase.from("contacts").insert(payload).select().single();
  const { data, error } = await query;

  return {
    contact: data || null,
    error,
  };
}

export async function deleteContact(contactId) {
  if (!supabaseConfigured || !contactId) {
    return {
      error: null,
    };
  }

  const { error } = await supabase.from("contacts").delete().eq("id", contactId);

  return {
    error,
  };
}

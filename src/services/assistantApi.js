const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8787";

export async function parseAssistantPrompt(
  prompt,
  clarificationContext = null,
  chatHistory = [],
  contacts = [],
  preferences = null,
  accessToken = "",
) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(`${backendUrl}/api/assistant/action`, {
    method: "POST",
    headers: getJsonHeaders(accessToken),
    body: JSON.stringify({
      prompt,
      clarificationContext,
      chatHistory,
      contacts,
      preferences,
      timezone,
      now: new Date().toISOString(),
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      action: "error",
      detail: payload.detail || "The assistant could not process the request.",
    };
  }

  return payload;
}

export async function createGoogleCalendarEvent(sessionId, event, accessToken = "") {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(`${backendUrl}/api/calendar/events`, {
    method: "POST",
    headers: getJsonHeaders(accessToken),
    body: JSON.stringify({
      sessionId,
      event,
      timezone,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      status: "error",
      detail: payload.detail || "Google Calendar could not create the event.",
    };
  }

  return payload;
}

export async function listGoogleCalendarEvents(sessionId, query, accessToken = "") {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(`${backendUrl}/api/calendar/events/list`, {
    method: "POST",
    headers: getJsonHeaders(accessToken),
    body: JSON.stringify({
      sessionId,
      query,
      timezone,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      status: "error",
      detail: payload.detail || "Google Calendar could not read events.",
    };
  }

  return payload;
}

export async function sendGmailMessage(sessionId, email, accessToken = "") {
  const response = await fetch(`${backendUrl}/api/email/send`, {
    method: "POST",
    headers: getJsonHeaders(accessToken),
    body: JSON.stringify({
      sessionId,
      email,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      status: "error",
      detail: payload.detail || "Gmail could not send the email.",
    };
  }

  return payload;
}

function getJsonHeaders(accessToken) {
  return {
    Authorization: accessToken ? `Bearer ${accessToken}` : "",
    "Content-Type": "application/json",
  };
}

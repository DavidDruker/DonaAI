const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8787";

export async function parseAssistantPrompt(
  prompt,
  clarificationContext = null,
  chatHistory = [],
) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(`${backendUrl}/api/assistant/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      clarificationContext,
      chatHistory,
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

export async function createGoogleCalendarEvent(sessionId, event) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const response = await fetch(`${backendUrl}/api/calendar/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

export async function sendGmailMessage(sessionId, email) {
  const response = await fetch(`${backendUrl}/api/email/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

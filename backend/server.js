const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URLSearchParams } = require("node:url");

loadEnvFile();

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const baseUrl = process.env.BACKEND_PUBLIC_URL || `http://localhost:${port}`;
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
const googleRedirectUri =
  process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/auth/google/callback`;
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const geminiModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const scopes = [
  "openid",
  "profile",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

const sessions = new Map();
const researchKeywords = [
  "research",
  "look up",
  "latest",
  "current",
  "recent",
  "source",
  "sources",
  "find",
  "find information",
  "find out",
  "apply your findings",
];

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, baseUrl);

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true });
    }

    if (request.method === "GET" && url.pathname === "/auth/google/start") {
      return startGoogleAuth(url, response);
    }

    if (request.method === "GET" && url.pathname === "/auth/google/debug") {
      return sendGoogleDebug(url, response);
    }

    if (request.method === "GET" && url.pathname === "/auth/google/callback") {
      return completeGoogleAuth(url, response);
    }

    if (request.method === "GET" && url.pathname === "/api/email/status") {
      return sendEmailStatus(url, response);
    }

    if (request.method === "POST" && url.pathname === "/api/assistant/action") {
      return parseAssistantAction(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/assistant/reminder") {
      return parseAssistantAction(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/calendar/events") {
      return createGoogleCalendarEvent(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/email/send") {
      return sendGmailMessage(request, response);
    }

    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    return sendHtml(
      response,
      500,
      page("Something went wrong", "The email connection did not complete."),
    );
  }
});

function startGoogleAuth(url, response) {
  const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();

  if (!googleClientId || !googleClientSecret) {
    sessions.set(sessionId, {
      status: "missing_config",
      provider: "gmail",
      detail: "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.",
    });

    return sendHtml(
      response,
      500,
      page(
        "Gmail is not configured",
        "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your backend environment.",
      ),
    );
  }

  sessions.set(sessionId, {
    status: "pending",
    provider: "gmail",
  });

  const params = createGoogleAuthParams(sessionId);

  response.writeHead(302, {
    Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
  response.end();
}

async function parseAssistantAction(request, response) {
  if (!geminiApiKey) {
    return sendJson(response, 500, {
      status: "missing_config",
      detail: "GEMINI_API_KEY is required on the backend.",
    });
  }

  const body = await readJsonBody(request);
  const prompt = String(body.prompt || "").trim();
  const clarificationContext =
    body.clarificationContext && typeof body.clarificationContext === "object"
      ? body.clarificationContext
      : null;
  const chatHistory = Array.isArray(body.chatHistory)
    ? body.chatHistory
        .slice(-8)
        .map((message) => ({
          role: String(message?.role || "").trim(),
          text: String(message?.text || "").trim(),
        }))
        .filter((message) => message.role && message.text)
    : [];

  if (!prompt) {
    return sendJson(response, 400, {
      status: "error",
      detail: "Prompt is required.",
    });
  }

  const timezone = String(body.timezone || "America/Toronto");
  const now = body.now ? new Date(body.now) : new Date();
  const originalPrompt = String(clarificationContext?.originalPrompt || "").trim();
  const clarificationQuestion = String(clarificationContext?.question || "").trim();
  const clarificationTurns = Array.isArray(clarificationContext?.turns)
    ? clarificationContext.turns
        .map((turn) => ({
          question: String(turn?.question || "").trim(),
          answer: String(turn?.answer || "").trim(),
        }))
        .filter((turn) => turn.question || turn.answer)
    : [];
  const effectivePrompt = originalPrompt
    ? [
        originalPrompt,
        "",
        "Clarification history:",
        ...clarificationTurns.map(
          (turn, index) =>
            `${index + 1}. Assistant asked: ${turn.question}\n   User answered: ${turn.answer}`,
        ),
        `${clarificationTurns.length + 1}. Assistant asked: ${clarificationQuestion}`,
        `   User answered: ${prompt}`,
      ].join("\n")
    : prompt;
  const chatHistoryText = chatHistory.length
    ? chatHistory
        .map((message, index) => `${index + 1}. ${message.role}: ${message.text}`)
        .join("\n")
    : "none";
  const shouldResearch = needsResearch(effectivePrompt);
  let researchBrief = "";

  if (shouldResearch) {
    const researchResult = await createResearchBrief(effectivePrompt, timezone, now);

    if (!researchResult.ok) {
      return sendJson(response, researchResult.status, {
        status: "error",
        detail: getGeminiErrorMessage(researchResult.status, researchResult.payload),
      });
    }

    researchBrief = researchResult.text;
  }

  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "You are the intent and content planner for a personal secretary app.",
              "Identify what the user wants, then return the structured action the app should perform.",
              "Supported actions: clarification_question, chat_response, create_reminder, create_alarm, create_calendar_event, send_email, unsupported.",
              "",
              "General chat rules:",
              "- Return chat_response for general conversation, explanations, advice, brainstorming, and information requests that do not ask you to create an email, reminder, alarm, or calendar event.",
              "- Use the recent chat history as context when it helps answer naturally.",
              "- Keep chat answers clear, useful, and conversational. Use short paragraphs when explaining something.",
              "- If the user asks for current facts or research, use available research findings when supplied and say when the answer may need verification.",
              "",
              "Clarification rules:",
              "- Prefer fulfilling clear requests immediately using reasonable defaults.",
              "- If clarification history is present, use the original request plus every clarification answer as one combined assignment.",
              "- Never treat a clarification answer by itself as a new standalone request.",
              "- Return clarification_question only when a missing detail would make the action wrong, risky, or impossible.",
              "- Ask exactly one short question that unlocks the action.",
              "- Do not ask about tone, length, depth, or sources unless the user explicitly makes that choice central to the request.",
              "- Do not ask for clarification when the missing detail is required data covered by another rule, such as a recipient email address or event time.",
              "- If a clarification answer is supplied in the user request, do not ask another clarification question unless the action is impossible without required data.",
              "",
              "Reminder rules:",
              "- Return create_reminder only when the user clearly asks to be reminded.",
              "- Resolve relative dates using the supplied current time and timezone.",
              "- If no specific time is given, choose 09:00 local time.",
              "",
              "Alarm rules:",
              "- Return create_alarm when the user asks to set an alarm, wake them up, or alert them at a specific time.",
              "- Resolve relative dates using the supplied current time and timezone.",
              "- If the user gives only a time and that time has already passed today, use the next day.",
              "- If the user gives only a time and that time has not passed today, use today.",
              "- Put the alarm time in due_at, use a short title, and make the confirmation say that the alarm was set.",
              "",
              "Calendar rules:",
              "- Return create_calendar_event only when the user clearly asks to schedule, book, add, or create a meeting/event.",
              "- If no duration is given, use 30 minutes.",
              "",
              "Email rules:",
              "- Return send_email only when the user clearly asks to send an email.",
              "- Require a recipient email address in the user request. If only a name is given, return unsupported and ask for the address in confirmation.",
              "- Always use a formal tone unless the user explicitly asks for a different tone.",
              "- Always address the recipient by first name unless the user explicitly says not to use a name.",
              "- If the recipient's first name is not clear from the request or email address, return clarification_question and ask for the recipient's first name before sending.",
              "- Do not merely repeat the user's instruction as the email body.",
              "- If the user asks you to explain, summarize, invite, apologize, follow up, decline, thank, research, or otherwise write content, compose the full email body yourself.",
              "- Preserve the user's key topic exactly. Correct obvious spelling mistakes, but do not replace the topic with a different concept.",
              "- If the request contains technical terms, identify the intended concept before writing. For example, 'parallel plate and electrical fields' means parallel plates/capacitors and electric fields, not magnetic poles or current-carrying wires.",
              "- If a technical request is too ambiguous to answer accurately, return clarification_question instead of guessing.",
              "- For educational explanations, write a clear, accurate explanation with definitions, the core principle, and a practical example when useful.",
              "- Organize explanatory emails before writing them: start with the main idea, then explain the concept in logical order, then give an example or implication, then close briefly.",
              "- Each paragraph must have one purpose. Do not merge the greeting, explanation, and closing into one paragraph.",
              "- Use transitions so the message reads like a coherent explanation, not a list of disconnected facts.",
              "- Before returning the email, silently proofread it for grammar, punctuation, capitalization, spacing, and sentence flow.",
              "- Return only polished final email copy. Do not include typos, awkward phrasing, repeated words, missing spaces, or broken sentence fragments.",
              "- Use complete sentences and standard English grammar unless the user explicitly asks for another style.",
              "- Do not write placeholder phrases like 'This email provides an explanation of...' or 'I hope this clarifies...' unless they add real value.",
              "- If research findings are supplied below, use them to synthesize the email body instead of saying that research was requested.",
              "- If no research findings are supplied, still compose the message from your own general knowledge when the request is clear.",
              "- If research sources are used and the user did not ask to omit sources, include a short 'Sources:' section with links at the end of the email body.",
              "- Match the requested tone only when one is explicitly provided.",
              "- Write a useful subject line when the user does not provide one.",
              "- Format the email with a greeting, separated paragraphs, and a professional sign-off. Include blank lines between those sections.",
              "- Keep the email body complete enough to satisfy the request, but avoid unnecessary length.",
              "",
              "Unsupported rules:",
              "- Return unsupported for other requests.",
              "- Do not invent missing recipient email addresses, dates, times, or attendees.",
              "",
              `Current time: ${now.toISOString()}`,
              `Timezone: ${timezone}`,
              `Recent chat history:\n${chatHistoryText}`,
              researchBrief
                ? `Research findings to apply:\n${researchBrief}`
                : "Research findings to apply: none supplied.",
              `Clarification already answered: ${clarificationContext ? "yes" : "no"}`,
              `User request: ${effectivePrompt}`,
            ].join("\n"),
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          action: {
            type: "string",
            enum: [
              "create_reminder",
              "create_alarm",
              "create_calendar_event",
              "send_email",
              "clarification_question",
              "chat_response",
              "unsupported",
            ],
            description: "The action the app should perform.",
          },
          title: {
            type: "string",
            description: "Short reminder or event title.",
          },
          due_at: {
            type: "string",
            description:
              "ISO 8601 timestamp for reminder due time, or an empty string for calendar events.",
          },
          start_at: {
            type: "string",
            description:
              "ISO 8601 timestamp for calendar event start, or an empty string for reminders.",
          },
          end_at: {
            type: "string",
            description:
              "ISO 8601 timestamp for calendar event end, or an empty string for reminders.",
          },
          notes: {
            type: "string",
            description: "Optional notes, or an empty string.",
          },
          location: {
            type: "string",
            description: "Optional calendar event location, or an empty string.",
          },
          confirmation: {
            type: "string",
            description:
              "Short human-readable confirmation, the clarification question when action is clarification_question, or the chat answer when action is chat_response.",
          },
          email_to: {
            type: "string",
            description: "Recipient email address, or an empty string.",
          },
          email_subject: {
            type: "string",
            description:
              "A useful email subject. If the user provides one, use it. Otherwise write one.",
          },
          email_body: {
            type: "string",
            description:
              "The complete email body to send, with greeting, separated paragraphs, and sign-off. Compose accurate requested explanations, research findings, or message content here; preserve key terms and do not repeat the user's instruction.",
          },
        },
        required: [
          "action",
          "title",
          "due_at",
          "start_at",
          "end_at",
          "notes",
          "location",
          "confirmation",
          "email_to",
          "email_subject",
          "email_body",
        ],
      },
    },
  };

  const geminiResponse = await fetchGeminiWithRetry(requestBody);
  const payload = await readGeminiPayload(geminiResponse);

  if (!geminiResponse.ok) {
    return sendJson(response, geminiResponse.status, {
      status: "error",
      detail: getGeminiErrorMessage(geminiResponse.status, payload),
    });
  }

  const text = getGeminiText(payload);

  try {
    return sendJson(response, 200, JSON.parse(text));
  } catch (error) {
    return sendJson(response, 500, {
      status: "error",
      detail: "Gemini returned an unexpected response.",
    });
  }
}

async function createResearchBrief(prompt, timezone, now) {
  const requestBody = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Research the user's request for a personal secretary app.",
              "Return a concise factual brief that can be used to write an email.",
              "Keep it to 5 bullets or fewer unless the user explicitly asks for more depth.",
              "Include the most relevant facts, explain context when useful, and include source URLs.",
              "Do not write JSON. Do not send or address the email yourself.",
              `Current time: ${now.toISOString()}`,
              `Timezone: ${timezone}`,
              `User request: ${prompt}`,
            ].join("\n"),
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
  };

  const response = await fetchGeminiWithRetry(requestBody);
  const payload = await readGeminiPayload(response);

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      payload,
    };
  }

  const text = getGeminiText(payload);
  const sources = getGroundingSources(payload);
  const sourceText = sources.length
    ? `\n\nSources:\n${sources.map((source) => `- ${source.title}: ${source.uri}`).join("\n")}`
    : "";

  return {
    ok: true,
    status: 200,
    text: `${text}${sourceText}`.trim(),
  };
}

async function fetchGeminiWithRetry(requestBody) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    geminiModel,
  )}:generateContent`;
  const retryableStatuses = new Set([429, 500, 502, 503, 504]);
  let lastResponse;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": geminiApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!retryableStatuses.has(response.status) || attempt === 3) {
      return response;
    }

    lastResponse = response;
    const payload = await readGeminiPayload(response.clone());
    const retryDelay = getRetryDelayMilliseconds(payload);
    const fallbackDelay = 1200 * 2 ** attempt + Math.floor(Math.random() * 500);

    await delay(Math.min(retryDelay || fallbackDelay, 10000));
  }

  return lastResponse;
}

async function readGeminiPayload(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function getGeminiText(payload) {
  return (
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function getGroundingSources(payload) {
  const chunks = payload.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const seen = new Set();

  return chunks
    .map((chunk) => chunk.web)
    .filter((web) => web?.uri)
    .filter((web) => {
      if (seen.has(web.uri)) {
        return false;
      }

      seen.add(web.uri);
      return true;
    })
    .slice(0, 5)
    .map((web) => ({
      title: web.title || web.uri,
      uri: web.uri,
    }));
}

function getRetryDelayMilliseconds(payload) {
  const details = payload.error?.details || [];
  const retryInfo = details.find((detail) =>
    String(detail["@type"] || "").includes("RetryInfo"),
  );
  const retryDelay = retryInfo?.retryDelay;

  if (!retryDelay) {
    return 0;
  }

  const seconds = Number(String(retryDelay).replace("s", ""));
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}

function getGeminiErrorMessage(status, payload) {
  const message = payload.error?.message || "";

  if (status === 503 || /overloaded|unavailable/i.test(message)) {
    return "Gemini is temporarily overloaded. I retried the request, but it is still unavailable. Please try again in a minute.";
  }

  if (status === 429 || /quota|rate|resource exhausted/i.test(message)) {
    return "Gemini is rate limiting this request right now. I retried when possible, but Google is still rejecting it. Please try again shortly.";
  }

  return message || "Gemini could not understand the request.";
}

function needsResearch(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  return researchKeywords.some((keyword) => lowerPrompt.includes(keyword));
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function sendGmailMessage(request, response) {
  const body = await readJsonBody(request);
  const sessionId = String(body.sessionId || "");
  const session = sessionId ? sessions.get(sessionId) : null;

  if (!session || session.status !== "connected" || !session.accessToken) {
    return sendJson(response, 401, {
      status: "not_connected",
      detail: "Connect Google first, then try sending the email again.",
    });
  }

  const email = body.email || {};

  if (!isValidEmailAddress(email.email_to)) {
    return sendJson(response, 400, {
      status: "error",
      detail: "A valid recipient email address is required.",
    });
  }

  if (!email.email_subject || !email.email_body) {
    return sendJson(response, 400, {
      status: "error",
      detail: "Email subject and body are required.",
    });
  }

  const raw = createRawEmail({
    to: email.email_to,
    subject: email.email_subject,
    body: email.email_body,
  });

  const gmailResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  const payload = await gmailResponse.json();

  if (!gmailResponse.ok) {
    return sendJson(response, gmailResponse.status, {
      status: "error",
      detail:
        payload.error?.message ||
        "Gmail could not send the email. Reconnect Google if send permission was just added.",
    });
  }

  return sendJson(response, 200, {
    status: "sent",
    id: payload.id,
    detail: email.confirmation || `Email sent to ${email.email_to}.`,
  });
}

function createRawEmail({ to, subject, body }) {
  const message = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function encodeMimeHeader(value) {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${Buffer.from(value).toString("base64")}?=`
    : value;
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

async function createGoogleCalendarEvent(request, response) {
  const body = await readJsonBody(request);
  const sessionId = String(body.sessionId || "");
  const session = sessionId ? sessions.get(sessionId) : null;

  if (!session || session.status !== "connected" || !session.accessToken) {
    return sendJson(response, 401, {
      status: "not_connected",
      detail: "Connect Google first, then try creating the calendar event again.",
    });
  }

  const event = body.event || {};
  const timezone = String(body.timezone || "America/Toronto");
  const startAt = new Date(event.start_at);
  const endAt = new Date(event.end_at);

  if (
    !event.title ||
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime())
  ) {
    return sendJson(response, 400, {
      status: "error",
      detail: "The calendar event title, start, or end time was invalid.",
    });
  }

  const calendarResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.notes || "",
        location: event.location || "",
        start: {
          dateTime: startAt.toISOString(),
          timeZone: timezone,
        },
        end: {
          dateTime: endAt.toISOString(),
          timeZone: timezone,
        },
      }),
    },
  );

  const payload = await calendarResponse.json();

  if (!calendarResponse.ok) {
    const detail =
      payload.error?.message ||
      "Google Calendar could not create the event. Reconnect Google if calendar permission was just added.";

    return sendJson(response, calendarResponse.status, {
      status: "error",
      detail,
    });
  }

  return sendJson(response, 200, {
    status: "created",
    id: payload.id,
    htmlLink: payload.htmlLink || "",
    detail: event.confirmation || `Calendar event created: ${event.title}`,
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";

    request.on("data", (chunk) => {
      data += chunk;
    });

    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendGoogleDebug(url, response) {
  const sessionId = url.searchParams.get("sessionId") || "debug-session";
  const params = createGoogleAuthParams(sessionId);

  return sendJson(response, 200, {
    googleClientConfigured: Boolean(googleClientId),
    googleSecretConfigured: Boolean(googleClientSecret),
    baseUrl,
    googleRedirectUri,
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  });
}

function createGoogleAuthParams(sessionId) {
  return new URLSearchParams({
    client_id: googleClientId,
    redirect_uri: googleRedirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: sessionId,
  });
}

async function completeGoogleAuth(url, response) {
  const sessionId = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (!sessionId) {
    return sendHtml(response, 400, page("Missing session", "No session was provided."));
  }

  if (error || !code) {
    sessions.set(sessionId, {
      status: "error",
      provider: "gmail",
      detail: error || "No authorization code was returned.",
    });

    return sendHtml(
      response,
      400,
      page("Gmail was not connected", "You can close this page and return to Secretary."),
    );
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: googleRedirectUri,
      grant_type: "authorization_code",
    }),
  });

  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok) {
    sessions.set(sessionId, {
      status: "error",
      provider: "gmail",
      detail: tokenPayload.error_description || tokenPayload.error || "Token exchange failed.",
    });

    return sendHtml(
      response,
      400,
      page("Gmail token exchange failed", "Check your Google OAuth credentials."),
    );
  }

  sessions.set(sessionId, {
    status: "connected",
    provider: "gmail",
    detail: "Gmail connected.",
    connectedAt: new Date().toISOString(),
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || "",
    expiresIn: tokenPayload.expires_in,
  });

  return sendHtml(
    response,
    200,
    page(
      "Gmail connected",
      "Return to Secretary and tap Refresh if the app does not update automatically.",
    ),
  );
}

function sendEmailStatus(url, response) {
  const sessionId = url.searchParams.get("sessionId");
  const session = sessionId ? sessions.get(sessionId) : null;

  if (!session) {
    return sendJson(response, 200, {
      status: "idle",
      detail: "No Gmail connection has been started.",
    });
  }

  return sendJson(response, 200, {
    status: session.status,
    provider: session.provider,
    detail: session.detail || "",
    connectedAt: session.connectedAt || "",
    hasRefreshToken: Boolean(session.refreshToken),
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(html);
}

function page(title, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        background: #081018;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        padding: 32px;
      }
      main {
        max-width: 520px;
      }
      p {
        color: #aeb8c8;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[char],
  );
}

server.listen(port, host, () => {
  console.log(`Secretary backend listening on ${baseUrl}`);
  console.log(`Google redirect URI: ${googleRedirectUri}`);
});

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

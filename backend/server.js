const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URLSearchParams } = require("node:url");

loadEnvFile();

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "0.0.0.0";
const baseUrl = cleanEnvValue(process.env.BACKEND_PUBLIC_URL) || `http://localhost:${port}`;
const googleClientId = cleanEnvValue(process.env.GOOGLE_CLIENT_ID);
const googleClientSecret = cleanEnvValue(process.env.GOOGLE_CLIENT_SECRET);
const googleRedirectUri =
  cleanEnvValue(process.env.GOOGLE_REDIRECT_URI) || `${baseUrl}/auth/google/callback`;
const geminiApiKey = cleanEnvValue(process.env.GEMINI_API_KEY);
const geminiModel = cleanEnvValue(process.env.GEMINI_MODEL) || "gemini-2.5-flash";
const supabaseUrl = cleanEnvValue(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
const tokenEncryptionSecret =
  cleanEnvValue(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) || googleClientSecret;
const appVersion = "2026-06-07-auth-route-fix";
const scopes = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

const sessions = new Map();
const rateLimitBuckets = new Map();
const maxJsonBodyBytes = 1024 * 1024;
const maxUrlLength = 2048;
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

function cleanEnvValue(value) {
  return String(value || "").trim();
}

const server = http.createServer(async (request, response) => {
  let url;

  try {
    if (String(request.url || "").length > maxUrlLength) {
      return sendJson(response, 414, {
        status: "error",
        detail: "Request URL is too long.",
      });
    }

    url = new URL(request.url, baseUrl);

    if (request.method === "OPTIONS") {
      return sendEmpty(response, 204);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        ok: true,
        version: appVersion,
      });
    }

    const rateLimit = checkRateLimit(request, url);

    if (!rateLimit.allowed) {
      return sendRateLimit(response, rateLimit);
    }

    if (request.method === "GET" && url.pathname === "/auth/google/start") {
      return await startGoogleAuth(url, response);
    }

    if (request.method === "GET" && url.pathname === "/auth/google/debug") {
      return sendGoogleDebug(url, response);
    }

    if (request.method === "GET" && url.pathname === "/auth/google/callback") {
      return await completeGoogleAuth(url, response);
    }

    if (request.method === "GET" && url.pathname === "/api/email/status") {
      return await sendEmailStatus(request, url, response);
    }

    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      return await signInWithSupabasePassword(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/assistant/action") {
      return await parseAssistantAction(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/assistant/reminder") {
      return await parseAssistantAction(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/calendar/events") {
      return await createGoogleCalendarEvent(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/calendar/events/list") {
      return await listGoogleCalendarEvents(request, response);
    }

    if (request.method === "POST" && url.pathname === "/api/email/send") {
      return await sendGmailMessage(request, response);
    }

    return sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);

    if (error.statusCode) {
      return sendJson(response, error.statusCode, {
        status: "error",
        detail: error.message,
      });
    }

    if (url?.pathname?.startsWith("/api/")) {
      return sendJson(response, 500, {
        status: "error",
        detail: "The backend hit an unexpected error. Check Render logs for details.",
      });
    }

    return sendHtml(
      response,
      500,
      page("Something went wrong", "The email connection did not complete."),
    );
  }
});

async function startGoogleAuth(url, response) {
  const sessionId = url.searchParams.get("sessionId") || crypto.randomUUID();

  if (!googleClientId || !googleClientSecret) {
    await saveSession(sessionId, {
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

  await saveSession(sessionId, {
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

  await requireAuthenticatedUser(request);

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
  const contacts = Array.isArray(body.contacts)
    ? body.contacts
        .slice(0, 100)
        .map((contact) => ({
          name: String(contact?.name || "").trim(),
          email: String(contact?.email || "").trim(),
        }))
        .filter((contact) => contact.name && isValidEmailAddress(contact.email))
    : [];
  const preferences =
    body.preferences && typeof body.preferences === "object"
      ? {
          name: String(body.preferences.name || "").trim(),
          tone: String(body.preferences.tone || "").trim(),
          emailFormality: String(body.preferences.emailFormality || "").trim(),
          emailLength: String(body.preferences.emailLength || "").trim(),
          defaultMeetingMinutes: String(
            body.preferences.defaultMeetingMinutes || "",
          ).trim(),
          emailSignoff: String(body.preferences.emailSignoff || "").trim(),
          emailDraftMode: String(body.preferences.emailDraftMode || "").trim(),
          additionalInstructions: String(
            body.preferences.additionalInstructions || "",
          ).trim(),
        }
      : {};

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
  const contactsText = contacts.length
    ? contacts
        .map((contact, index) => `${index + 1}. ${contact.name}: ${contact.email}`)
        .join("\n")
    : "none";
  const preferencesText = formatUserPreferences(preferences);
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
              "You are the intent and content planner for a personal assistant app.",
              "Identify what the user wants, then return the structured action the app should perform.",
              "Supported actions: clarification_question, chat_response, create_reminder, create_alarm, create_calendar_event, list_calendar_events, send_email, unsupported.",
              "",
              "General chat rules:",
              "- Return chat_response for general conversation, explanations, advice, brainstorming, and information requests that do not ask you to create an email, reminder, alarm, or calendar event.",
              "- Follow the user's saved preferences when tone, email style, meeting defaults, sign-off, or additional instructions are relevant.",
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
              "- Return list_calendar_events when the user asks what is on their calendar, what meetings/events they have, whether they are free or busy, or asks to review, summarize, recap, audit, or list their schedule.",
              "- For list_calendar_events, resolve the requested date range into start_at and end_at. If no date range is given, use today from 00:00 through 23:59 local time.",
              "- For daily summaries, use the requested day from 00:00 through 23:59 local time.",
              "- For weekly summaries, use the full requested week from Monday 00:00 through Sunday 23:59 local time unless the user gives different boundaries.",
              "- For monthly summaries, use the full requested month from day 1 at 00:00 through the last day at 23:59 local time.",
              "- If the user asks for a named month such as May, use that whole month in the current year unless the user gives a different year.",
              "- For list_calendar_events, preserve the actual date range. Never collapse every event to the first day of the range.",
              "- If the user asks for dates, include dates by choosing a multi-day date range rather than answering from memory.",
              "- For list_calendar_events, use a short title such as Calendar review.",
              "- If no duration is given, use 30 minutes.",
              "",
              "Email rules:",
              "- Return send_email only when the user clearly asks to send an email.",
              "- If the user gives a recipient name instead of an email address, use the matching saved contact from the contact list.",
              "- Require a recipient email address in the user request or a clear matching saved contact. If only a name is given and it does not match exactly one saved contact, return clarification_question and ask which email address to use.",
              "- Check that email_to looks like a valid email address before returning send_email. It must contain one @, a domain, and a top-level domain, with no spaces.",
              "- If the provided email address looks invalid or incomplete, return clarification_question and ask the user for the correct email address.",
              "- Do not claim the recipient mailbox exists. The app can validate email format and domain delivery only, not whether an individual inbox exists.",
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
              "- End emails with the saved email sign-off exactly when one is supplied. Do not invent a different sender name.",
              "- Keep the email body complete enough to satisfy the request, but avoid unnecessary length.",
              "",
              "Unsupported rules:",
              "- Return unsupported for other requests.",
              "- Do not invent missing recipient email addresses, dates, times, or attendees.",
              "",
              `Current time: ${now.toISOString()}`,
              `Timezone: ${timezone}`,
              `Recent chat history:\n${chatHistoryText}`,
              `Saved contacts:\n${contactsText}`,
              `Saved user preferences:\n${preferencesText}`,
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
              "list_calendar_events",
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
              "Research the user's request for a personal assistant app.",
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

function formatUserPreferences(preferences) {
  const lines = [];

  if (preferences.name) {
    lines.push(`Preferred name: ${preferences.name}`);
  }

  if (preferences.tone) {
    lines.push(`Tone: ${preferences.tone}`);
  }

  if (preferences.emailFormality) {
    lines.push(`Email formality: ${preferences.emailFormality}`);
  }

  if (preferences.emailLength) {
    lines.push(`Email length: ${preferences.emailLength}`);
  }

  if (preferences.defaultMeetingMinutes) {
    lines.push(`Default meeting duration: ${preferences.defaultMeetingMinutes} minutes`);
  }

  if (preferences.emailSignoff) {
    lines.push(`Email sign-off:\n${preferences.emailSignoff}`);
  }

  if (preferences.emailDraftMode) {
    lines.push(
      `Email sending preference: ${
        preferences.emailDraftMode === "send_immediately"
          ? "send directly without showing a draft"
          : "show a draft before sending"
      }`,
    );
  }

  if (preferences.additionalInstructions) {
    lines.push(`Additional instructions: ${preferences.additionalInstructions}`);
  }

  return lines.length ? lines.join("\n") : "none";
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

async function signInWithSupabasePassword(request, response) {
  if (!isSupabaseAuthConfigured()) {
    return sendJson(response, 500, {
      status: "missing_config",
      detail: "Supabase authentication is not configured on the backend.",
    });
  }

  const body = await readJsonBody(request);
  const email = String(body.email || "").trim();
  const password = String(body.password || "");

  if (!isValidEmailAddress(email) || !password) {
    return sendJson(response, 400, {
      status: "error",
      detail: "Email and password are required.",
    });
  }

  const base = supabaseUrl.replace(/\/+$/g, "");
  const authResponse = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  const payload = await readJsonResponse(authResponse);

  if (!authResponse.ok) {
    return sendJson(response, authResponse.status, {
      status: "error",
      detail:
        payload.error_description ||
        payload.msg ||
        payload.message ||
        "Supabase login failed.",
    });
  }

  return sendJson(response, 200, {
    status: "ok",
    session: {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_in: payload.expires_in,
      expires_at: payload.expires_at,
      token_type: payload.token_type,
      user: payload.user,
    },
    user: payload.user || null,
  });
}

async function sendGmailMessage(request, response) {
  const body = await readJsonBody(request);
  const sessionId = String(body.sessionId || "");
  const user = await requireAuthenticatedUser(request);
  assertSessionBelongsToUser(sessionId, user);
  const session = await getSession(sessionId);

  if (!session || session.status !== "connected") {
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

  const domainCheck = await checkEmailDomain(email.email_to);

  if (!domainCheck.valid) {
    return sendJson(response, 400, {
      status: "error",
      detail: domainCheck.detail,
    });
  }

  if (!email.email_subject || !email.email_body) {
    return sendJson(response, 400, {
      status: "error",
      detail: "Email subject and body are required.",
    });
  }

  const tokenResult = await getValidGoogleAccessToken(session);

  if (!tokenResult.ok) {
    await saveSession(sessionId, {
      ...session,
      status: "error",
      detail: tokenResult.detail,
    });

    return sendJson(response, 401, {
      status: "not_connected",
      detail: tokenResult.detail,
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
        Authorization: `Bearer ${tokenResult.accessToken}`,
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
    detail:
      email.confirmation ||
      `Gmail accepted the message for ${email.email_to}.`,
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

async function checkEmailDomain(value) {
  const domain = String(value || "").split("@").pop().toLowerCase();

  if (!domain) {
    return {
      valid: false,
      detail: "A valid recipient email domain is required.",
    };
  }

  try {
    const mxRecords = await dns.resolveMx(domain);

    if (mxRecords.length > 0) {
      return { valid: true };
    }
  } catch (error) {
    // Some domains can still receive mail through A/AAAA fallback, checked below.
  }

  try {
    const addresses = await dns.resolve(domain);

    if (addresses.length > 0) {
      return { valid: true };
    }
  } catch (error) {
    return {
      valid: false,
      detail:
        "That email domain does not appear to receive mail. Please check the recipient address.",
    };
  }

  return {
    valid: false,
    detail:
      "That email domain does not appear to receive mail. Please check the recipient address.",
  };
}

async function createGoogleCalendarEvent(request, response) {
  const body = await readJsonBody(request);
  const sessionId = String(body.sessionId || "");
  const user = await requireAuthenticatedUser(request);
  assertSessionBelongsToUser(sessionId, user);
  const session = await getSession(sessionId);

  if (!session || session.status !== "connected") {
    return sendJson(response, 401, {
      status: "not_connected",
      detail: "Connect Google first, then try creating the calendar event again.",
    });
  }

  const tokenResult = await getValidGoogleAccessToken(session);

  if (!tokenResult.ok) {
    await saveSession(sessionId, {
      ...session,
      status: "error",
      detail: tokenResult.detail,
    });

    return sendJson(response, 401, {
      status: "not_connected",
      detail: tokenResult.detail,
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
        Authorization: `Bearer ${tokenResult.accessToken}`,
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

async function listGoogleCalendarEvents(request, response) {
  const body = await readJsonBody(request);
  const sessionId = String(body.sessionId || "");
  const user = await requireAuthenticatedUser(request);
  assertSessionBelongsToUser(sessionId, user);
  const session = await getSession(sessionId);

  if (!session || session.status !== "connected") {
    return sendJson(response, 401, {
      status: "not_connected",
      detail: "Connect Google first, then try reviewing your calendar again.",
    });
  }

  const tokenResult = await getValidGoogleAccessToken(session);

  if (!tokenResult.ok) {
    await saveSession(sessionId, {
      ...session,
      status: "error",
      detail: tokenResult.detail,
    });

    return sendJson(response, 401, {
      status: "not_connected",
      detail: tokenResult.detail,
    });
  }

  const query = body.query || {};
  const timezone = String(body.timezone || "America/Toronto");
  const range = getCalendarQueryRange(query, timezone);

  if (!range.valid) {
    return sendJson(response, 400, {
      status: "error",
      detail: range.detail,
    });
  }

  const params = new URLSearchParams({
    timeMin: range.startAt.toISOString(),
    timeMax: range.endAt.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const calendarResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${tokenResult.accessToken}`,
      },
    },
  );
  const payload = await calendarResponse.json();

  if (!calendarResponse.ok) {
    return sendJson(response, calendarResponse.status, {
      status: "error",
      detail:
        payload.error?.message ||
        "Google Calendar could not read events. Reconnect Google if calendar permission was just added.",
    });
  }

  const events = (payload.items || []).map((event) => normalizeCalendarEvent(event, timezone));

  return sendJson(response, 200, {
    status: "ok",
    events,
    detail: formatCalendarEventsDetail(events, range, timezone),
  });
}

function getCalendarQueryRange(query, timezone) {
  const startAt = query.start_at ? new Date(query.start_at) : startOfToday();
  const endAt = query.end_at ? new Date(query.end_at) : endOfToday();

  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    return {
      valid: false,
      detail: "The calendar date range could not be understood.",
    };
  }

  if (endAt <= startAt) {
    return {
      valid: false,
      detail: "The calendar end time must be after the start time.",
    };
  }

  return {
    valid: true,
    startAt,
    endAt,
    timezone,
  };
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeCalendarEvent(event, timezone) {
  const startValue = event.start?.dateTime || event.start?.date || "";
  const endValue = event.end?.dateTime || event.end?.date || "";

  return {
    id: event.id || "",
    title: event.summary || "Untitled event",
    start: startValue,
    end: endValue,
    location: event.location || "",
    description: event.description || "",
    htmlLink: event.htmlLink || "",
    allDay: Boolean(event.start?.date),
    startLabel: formatCalendarDateTime(startValue, timezone, Boolean(event.start?.date)),
    endLabel: formatCalendarDateTime(endValue, timezone, Boolean(event.end?.date)),
  };
}

function formatCalendarEventsDetail(events, range, timezone) {
  const rangeLabel = formatCalendarRangeLabel(range, timezone);

  if (events.length === 0) {
    return `You do not have any calendar events for ${rangeLabel}.`;
  }

  const multiDay = isMultiDayCalendarRange(range, timezone);
  const summaryLines = formatCalendarSummaryLines(events, range, timezone, multiDay);
  const lines = events.map((event, index) => {
    const location = event.location ? ` at ${event.location}` : "";
    const when = formatCalendarEventWhen(event, timezone, multiDay);

    return `${index + 1}. ${when}: ${event.title}${location}`;
  });

  return [
    `Here is your calendar for ${rangeLabel}:`,
    ...summaryLines,
    "",
    "Agenda:",
    ...lines,
  ].join("\n");
}

function formatCalendarSummaryLines(events, range, timezone, multiDay) {
  const lines = [`Summary: ${events.length} event${events.length === 1 ? "" : "s"}.`];
  const timedEvents = events.filter((event) => !event.allDay);
  const conflicts = findCalendarConflicts(timedEvents);

  if (multiDay) {
    const eventsByDay = groupEventsByDay(events, timezone);
    const busiestDay = getBusiestCalendarDay(eventsByDay);

    if (busiestDay) {
      lines.push(`Busiest day: ${busiestDay.label} with ${busiestDay.count} event${busiestDay.count === 1 ? "" : "s"}.`);
    }

    const freeDays = getFreeCalendarDays(eventsByDay, range, timezone);

    if (freeDays.length > 0 && freeDays.length <= 7) {
      lines.push(`No events listed on: ${freeDays.join(", ")}.`);
    } else if (freeDays.length > 7) {
      lines.push(`${freeDays.length} days have no events listed.`);
    }
  }

  if (conflicts.length > 0) {
    lines.push(`Possible conflicts: ${conflicts.slice(0, 3).join("; ")}.`);
  }

  return lines;
}

function groupEventsByDay(events, timezone) {
  const groups = new Map();

  events.forEach((event) => {
    const key = getCalendarDayKey(event.start, timezone, event.allDay);

    if (!key) {
      return;
    }

    const current = groups.get(key) || {
      count: 0,
      label: formatCalendarDateOnly(event.start, timezone, event.allDay),
    };

    current.count += 1;
    groups.set(key, current);
  });

  return groups;
}

function getBusiestCalendarDay(eventsByDay) {
  return Array.from(eventsByDay.values()).sort((left, right) => right.count - left.count)[0] || null;
}

function getFreeCalendarDays(eventsByDay, range, timezone) {
  const days = [];
  const cursor = new Date(range.startAt);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(range.endAt);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end && days.length < 32) {
    const key = getCalendarDayKey(cursor.toISOString(), timezone, false);

    if (key && !eventsByDay.has(key)) {
      days.push(formatCalendarDateOnly(cursor.toISOString(), timezone, false));
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function findCalendarConflicts(events) {
  const sortedEvents = events
    .map((event) => ({
      ...event,
      startMs: Date.parse(event.start),
      endMs: Date.parse(event.end),
    }))
    .filter((event) => !Number.isNaN(event.startMs) && !Number.isNaN(event.endMs))
    .sort((left, right) => left.startMs - right.startMs);
  const conflicts = [];

  for (let index = 1; index < sortedEvents.length; index += 1) {
    const previous = sortedEvents[index - 1];
    const current = sortedEvents[index];

    if (current.startMs < previous.endMs) {
      conflicts.push(`${current.title} overlaps with ${previous.title}`);
    }
  }

  return conflicts;
}

function getCalendarDayKey(value, timezone, allDay) {
  if (!value) {
    return "";
  }

  const date = allDay ? new Date(`${value}T00:00:00`) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).format(date);
}

function formatCalendarRangeLabel(range, timezone) {
  const formatter = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: timezone,
  });
  const startLabel = formatter.format(range.startAt);
  const endLabel = formatter.format(range.endAt);

  return startLabel === endLabel ? startLabel : `${startLabel} through ${endLabel}`;
}

function isMultiDayCalendarRange(range, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  });

  return formatter.format(range.startAt) !== formatter.format(range.endAt);
}

function formatCalendarEventWhen(event, timezone, includeDate) {
  const dateLabel = includeDate
    ? formatCalendarDateOnly(event.start, timezone, event.allDay)
    : "";

  if (event.allDay) {
    return dateLabel ? `${dateLabel}, all day` : "All day";
  }

  const timeLabel = `${event.startLabel}${event.endLabel ? ` - ${event.endLabel}` : ""}`;

  return dateLabel ? `${dateLabel}, ${timeLabel}` : timeLabel;
}

function formatCalendarDateOnly(value, timezone, allDay) {
  if (!value) {
    return "";
  }

  const date = allDay ? new Date(`${value}T00:00:00`) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: timezone,
  }).format(date);
}

function formatCalendarDateTime(value, timezone, allDay) {
  if (!value) {
    return "";
  }

  if (allDay) {
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: timezone,
    }).format(date);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    let byteLength = 0;
    let tooLarge = false;

    request.on("data", (chunk) => {
      byteLength += chunk.length;

      if (byteLength > maxJsonBodyBytes) {
        tooLarge = true;
        request.destroy();
        return;
      }

      data += chunk;
    });

    request.on("end", () => {
      if (tooLarge) {
        reject(createHttpError(413, "Request body is too large."));
        return;
      }

      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(createHttpError(400, "Request body must be valid JSON."));
      }
    });

    request.on("error", () => {
      reject(
        tooLarge
          ? createHttpError(413, "Request body is too large.")
          : createHttpError(400, "Request body could not be read."),
      );
    });
  });
}

async function readJsonResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return {
      message: text,
    };
  }
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

  const session = await getSession(sessionId);

  if (!session || session.status !== "pending") {
    return sendHtml(response, 400, page("Invalid session", "This Gmail sign-in session is no longer valid."));
  }

  if (error || !code) {
    await saveSession(sessionId, {
      status: "error",
      provider: "gmail",
      detail: error || "No authorization code was returned.",
    });

    return sendHtml(
      response,
      400,
      page("Gmail was not connected", "You can close this page and return to Dona AI."),
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
    await saveSession(sessionId, {
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

  await saveSession(sessionId, {
    status: "connected",
    provider: "gmail",
    detail: "Gmail connected.",
    connectedAt: new Date().toISOString(),
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || session.refreshToken || "",
    expiresIn: tokenPayload.expires_in,
    expiresAt: Date.now() + Number(tokenPayload.expires_in || 0) * 1000,
  });

  return sendHtml(
    response,
    200,
    page(
      "Gmail connected",
      "Return to Dona AI and tap Refresh if the app does not update automatically.",
    ),
  );
}

async function sendEmailStatus(request, url, response) {
  try {
    const sessionId = url.searchParams.get("sessionId");

    const session = await getSession(sessionId);

    if (!session) {
      return sendJson(response, 200, {
        status: "idle",
        detail: "No Gmail connection has been started.",
        provider: "gmail",
      });
    }

    return sendJson(response, 200, {
      status: session.status,
      provider: session.provider,
      detail: session.detail || "",
      connectedAt: session.connectedAt || "",
      hasRefreshToken: Boolean(session.refreshToken),
    });
  } catch (error) {
    return sendJson(response, error.statusCode || 500, {
      status: "error",
      detail: error.message || "Gmail connection status could not be checked.",
      provider: "gmail",
    });
  }
}

async function getValidGoogleAccessToken(session) {
  if (!session.accessToken) {
    return refreshGoogleAccessToken(session);
  }

  const expiresAt = Number(session.expiresAt || 0);
  const refreshWindowMilliseconds = 60 * 1000;

  if (!expiresAt || expiresAt - Date.now() > refreshWindowMilliseconds) {
    return {
      ok: true,
      accessToken: session.accessToken,
    };
  }

  if (!session.refreshToken) {
    return {
      ok: false,
      detail: "Google access expired. Reconnect Google and try again.",
    };
  }

  return refreshGoogleAccessToken(session);
}

async function refreshGoogleAccessToken(session) {
  if (!session.refreshToken) {
    return {
      ok: false,
      detail: "Google access expired. Reconnect Google and try again.",
    };
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: googleClientId,
      client_secret: googleClientSecret,
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const tokenPayload = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return {
      ok: false,
      detail:
        tokenPayload.error_description ||
        tokenPayload.error ||
        "Google access expired. Reconnect Google and try again.",
    };
  }

  session.accessToken = tokenPayload.access_token;
  session.expiresIn = tokenPayload.expires_in;
  session.expiresAt = Date.now() + Number(tokenPayload.expires_in || 0) * 1000;

  if (session.sessionId) {
    await saveSession(session.sessionId, session);
  }

  return {
    ok: true,
    accessToken: session.accessToken,
  };
}

async function getSession(sessionId) {
  if (!sessionId) {
    return null;
  }

  const cached = sessions.get(sessionId);

  if (cached) {
    return {
      ...cached,
      sessionId,
    };
  }

  const stored = await getStoredSession(sessionId);

  if (!stored) {
    return null;
  }

  sessions.set(sessionId, stored);

  return {
    ...stored,
    sessionId,
  };
}

async function saveSession(sessionId, session) {
  if (!sessionId) {
    return;
  }

  const nextSession = {
    ...session,
  };
  delete nextSession.sessionId;
  sessions.set(sessionId, nextSession);
  await saveStoredSession(sessionId, nextSession);
}

async function getStoredSession(sessionId) {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const row = await findStoredSessionRow(sessionId);

    if (!row) {
      return null;
    }

    return deserializeStoredSession(row);
  } catch (error) {
    console.error("Could not load Supabase session:", error.message);
    return null;
  }
}

async function findStoredSessionRow(sessionId) {
  const rows = await supabaseRequest(
    "GET",
    `/google_oauth_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;

  if (row) {
    return row;
  }

  const userId = getUserIdFromSessionId(sessionId);

  if (!userId) {
    return null;
  }

  const userRows = await supabaseRequest(
    "GET",
    `/google_oauth_sessions?user_id=eq.${encodeURIComponent(userId)}&select=*&order=updated_at.desc&limit=1`,
  );

  return Array.isArray(userRows) ? userRows[0] || null : null;
}

async function saveStoredSession(sessionId, session) {
  if (!isSupabaseConfigured()) {
    return;
  }

  try {
    await supabaseRequest(
      "POST",
      "/google_oauth_sessions?on_conflict=session_id",
      serializeStoredSession(sessionId, session),
      {
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
    );
  } catch (error) {
    console.error("Could not save Supabase session:", error.message);
  }
}

function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey && tokenEncryptionSecret);
}

async function supabaseRequest(method, pathAndQuery, body, extraHeaders = {}) {
  const base = supabaseUrl.replace(/\/+$/g, "");
  const response = await fetch(`${base}/rest/v1${pathAndQuery}`, {
    method,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function serializeStoredSession(sessionId, session) {
  const row = {
    session_id: sessionId,
    user_id: getUserIdFromSessionId(sessionId),
    status: session.status || "idle",
    provider: session.provider || "gmail",
    detail: session.detail || "",
    connected_at: session.connectedAt || null,
    expires_in: Number(session.expiresIn || 0) || null,
    expires_at: session.expiresAt ? new Date(Number(session.expiresAt)).toISOString() : null,
    scopes,
    updated_at: new Date().toISOString(),
  };

  if (session.accessToken) {
    row.access_token = encryptText(session.accessToken);
  }

  if (session.refreshToken) {
    row.refresh_token = encryptText(session.refreshToken);
  }

  return row;
}

function getUserIdFromSessionId(sessionId) {
  const prefix = "supabase-user-";
  const value = String(sessionId || "");

  return value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

function deserializeStoredSession(row) {
  return {
    status: row.status || "idle",
    provider: row.provider || "gmail",
    detail: row.detail || "",
    connectedAt: row.connected_at || "",
    accessToken: row.access_token ? decryptText(row.access_token) : "",
    refreshToken: row.refresh_token ? decryptText(row.refresh_token) : "",
    expiresIn: row.expires_in || 0,
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : 0,
  };
}

function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decryptText(value) {
  const [ivText, tagText, encryptedText] = String(value).split(".");

  if (!ivText || !tagText || !encryptedText) {
    return "";
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getTokenEncryptionKey(),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function getTokenEncryptionKey() {
  return crypto.createHash("sha256").update(tokenEncryptionSecret).digest();
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function requireAuthenticatedUser(request) {
  if (!isSupabaseAuthConfigured()) {
    throw createHttpError(500, "Supabase authentication is not configured on the backend.");
  }

  const token = getBearerToken(request);

  if (!token) {
    throw createHttpError(401, "Log in again before using this backend action.");
  }

  const base = supabaseUrl.replace(/\/+$/g, "");
  let authResponse;

  try {
    authResponse = await fetch(`${base}/auth/v1/user`, {
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    const hostname = getHostnameFromUrl(base) || "the configured Supabase URL";
    const causeCode = error?.cause?.code || error?.code || "";

    if (causeCode === "ENOTFOUND") {
      throw createHttpError(
        500,
        `Supabase could not be reached at ${hostname}. Check SUPABASE_URL in Render for a typo.`,
      );
    }

    throw createHttpError(
      502,
      `Supabase authentication could not be reached at ${hostname}. Try again in a moment.`,
    );
  }

  if (!authResponse.ok) {
    throw createHttpError(401, "Your login session could not be verified.");
  }

  const user = await authResponse.json();

  if (!user?.id) {
    throw createHttpError(401, "Your login session could not be verified.");
  }

  return user;
}

function assertSessionBelongsToUser(sessionId, user) {
  const sessionUserId = getUserIdFromSessionId(sessionId);

  if (!sessionUserId || sessionUserId !== user.id) {
    throw createHttpError(403, "This Google connection does not belong to the logged-in user.");
  }
}

function getBearerToken(request) {
  const header = String(request.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);

  return match ? match[1].trim() : "";
}

function isSupabaseAuthConfigured() {
  return Boolean(supabaseUrl && supabaseServiceRoleKey);
}

function getHostnameFromUrl(value) {
  try {
    return new URL(value).hostname;
  } catch (error) {
    return "";
  }
}

function checkRateLimit(request, url) {
  const routeKey = `${request.method} ${url.pathname}`;
  const config = getRateLimitConfig(routeKey);

  if (!config) {
    return {
      allowed: true,
    };
  }

  const now = Date.now();
  const clientId = getClientIp(request);
  const bucketKey = `${clientId}:${routeKey}`;
  const bucket = rateLimitBuckets.get(bucketKey);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    cleanupRateLimitBuckets(now);

    return {
      allowed: true,
    };
  }

  if (bucket.count >= config.max) {
    return {
      allowed: false,
      limit: config.max,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      resetAt: bucket.resetAt,
    };
  }

  bucket.count += 1;

  return {
    allowed: true,
  };
}

function getRateLimitConfig(route) {
  if (process.env.RATE_LIMIT_DISABLED === "true") {
    return null;
  }

  const minute = 60 * 1000;

  const limits = {
    "GET /auth/google/start": { max: 10, windowMs: 10 * minute },
    "GET /auth/google/debug": { max: 20, windowMs: minute },
    "GET /auth/google/callback": { max: 20, windowMs: minute },
    "POST /api/auth/login": { max: 10, windowMs: minute },
    "GET /api/email/status": { max: 120, windowMs: minute },
    "POST /api/assistant/action": { max: 20, windowMs: minute },
    "POST /api/assistant/reminder": { max: 20, windowMs: minute },
    "POST /api/calendar/events": { max: 20, windowMs: minute },
    "POST /api/calendar/events/list": { max: 60, windowMs: minute },
    "POST /api/email/send": { max: 10, windowMs: minute },
  };

  return limits[route] || { max: 120, windowMs: minute };
}

function getClientIp(request) {
  const forwardedFor = String(request.headers["x-forwarded-for"] || "");
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();

  return (
    firstForwardedIp ||
    String(request.headers["x-real-ip"] || "").trim() ||
    request.socket?.remoteAddress ||
    "unknown"
  );
}

function cleanupRateLimitBuckets(now) {
  if (rateLimitBuckets.size < 1000) {
    return;
  }

  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

function sendEmpty(response, statusCode) {
  response.writeHead(statusCode, {
    ...getCorsHeaders(),
    ...getSecurityHeaders(),
    ...getNoStoreHeaders(),
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end();
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    ...getCorsHeaders(),
    ...getSecurityHeaders(),
    ...getNoStoreHeaders(),
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(payload));
}

function sendRateLimit(response, rateLimit) {
  response.writeHead(429, {
    ...getCorsHeaders(),
    ...getSecurityHeaders(),
    ...getNoStoreHeaders(),
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
    "Retry-After": String(rateLimit.retryAfterSeconds),
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  });
  response.end(
    JSON.stringify({
      status: "rate_limited",
      detail: `Too many requests. Try again in ${rateLimit.retryAfterSeconds} seconds.`,
    }),
  );
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    ...getSecurityHeaders(),
    ...getNoStoreHeaders(),
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "Content-Type": "text/html; charset=utf-8",
  });
  response.end(html);
}

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": cleanEnvValue(process.env.CORS_ALLOW_ORIGIN) || "*",
  };
}

function getSecurityHeaders() {
  return {
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function getNoStoreHeaders() {
  return {
    "Cache-Control": "no-store",
  };
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
  console.log(`DonaAI backend listening on ${baseUrl}`);
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

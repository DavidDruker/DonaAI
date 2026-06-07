import * as WebBrowser from "expo-web-browser";

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8787";
let emailSessionId = "";

export function setGoogleSessionUserId(userId) {
  emailSessionId = userId ? `supabase-user-${userId}` : "";
}

export function getGoogleSessionId() {
  return emailSessionId || "anonymous-mobile-session";
}

export function getEmailAccessSummary(connection) {
  if (connection?.status === "connected") {
    return {
      status: "authorized",
      detail: "Gmail is connected through the backend.",
      provider: "gmail",
    };
  }

  if (connection?.detail) {
    return {
      status: "needs_oauth",
      detail: connection.detail,
      provider: connection.provider || "",
    };
  }

  return {
    status: "needs_oauth",
    detail: "Connect Gmail once so Dona can use your Google mail and calendar permissions.",
    provider: "",
  };
}

export function getEmailProviders() {
  return [
    {
      key: "gmail",
      name: "Gmail",
      configured: Boolean(backendUrl),
    },
    {
      key: "microsoft",
      name: "Microsoft",
      configured: false,
    },
  ];
}

export async function startEmailAuthorization(providerKey, accessToken = "") {
  if (providerKey !== "gmail") {
    return {
      status: "planned",
      detail: "Microsoft email will use the same backend OAuth pattern next.",
    };
  }

  const authUrl = `${backendUrl}/auth/google/start?sessionId=${encodeURIComponent(
    getGoogleSessionId(),
  )}`;

  await WebBrowser.openBrowserAsync(authUrl);
  return waitForEmailConnection(accessToken);
}

export async function refreshEmailConnection(accessToken = "") {
  try {
    const statusUrl = `${backendUrl}/api/email/status?sessionId=${encodeURIComponent(
      getGoogleSessionId(),
    )}`;
    const response = await fetch(statusUrl, {
      headers: {
        Authorization: accessToken ? `Bearer ${accessToken}` : "",
      },
    });
    const payload = await readJsonResponse(response);

    if (!response.ok) {
      return {
        status: "backend_error",
        detail:
          payload.detail ||
          `Backend returned HTTP ${response.status}. Check the Render logs for DonaAI.`,
        provider: payload.provider || "gmail",
      };
    }

    return {
      status: payload.status,
      detail: payload.detail || getStatusDetail(payload.status),
      provider: payload.provider || "gmail",
      providerName: "Gmail",
      connectedAt: payload.connectedAt || "",
      hasRefreshToken: Boolean(payload.hasRefreshToken),
    };
  } catch (error) {
    return {
      status: "backend_unreachable",
      detail: `Cannot reach backend at ${backendUrl}. Check Render is deployed and passing /health.`,
    };
  }
}

export function getEmailRuntimeInfo() {
  return {
    backendUrl,
    redirectUri: `${backendUrl}/auth/google/callback`,
  };
}

async function waitForEmailConnection(accessToken = "") {
  const attempts = 8;

  for (let index = 0; index < attempts; index += 1) {
    const result = await refreshEmailConnection(accessToken);

    if (
      result.status === "connected" ||
      result.status === "error" ||
      result.status === "missing_config"
    ) {
      return result;
    }

    await delay(1200);
  }

  return {
    status: "pending",
    detail:
      "Gmail sign-in opened in the browser. If you finished signing in, tap Refresh to confirm the connection.",
    provider: "gmail",
    providerName: "Gmail",
  };
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getStatusDetail(status) {
  if (status === "connected") {
    return "Gmail is connected.";
  }

  if (status === "pending") {
    return "Gmail authorization is still pending.";
  }

  if (status === "missing_config") {
    return "The backend needs Google OAuth credentials.";
  }

  return "Gmail is not connected yet.";
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
      detail: formatNonJsonBackendText(text),
    };
  }
}

function formatNonJsonBackendText(text) {
  const cleanText = String(text || "").trim();

  if (!cleanText) {
    return "";
  }

  if (/^\s*<!doctype html/i.test(cleanText) || /^\s*<html/i.test(cleanText)) {
    const title = cleanText.match(/<title>(.*?)<\/title>/is)?.[1];
    const heading = cleanText.match(/<h1>(.*?)<\/h1>/is)?.[1];
    const paragraph = cleanText.match(/<p>(.*?)<\/p>/is)?.[1];
    const message = [heading || title, paragraph]
      .filter(Boolean)
      .join(": ")
      .replace(/<[^>]*>/g, "")
      .trim();

    return message || "The backend returned an HTML error page. Check Render logs.";
  }

  return cleanText.length > 240 ? `${cleanText.slice(0, 237)}...` : cleanText;
}

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

export async function startEmailAuthorization(providerKey) {
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
  return waitForEmailConnection();
}

export async function refreshEmailConnection() {
  try {
    const statusUrl = `${backendUrl}/api/email/status?sessionId=${encodeURIComponent(
      getGoogleSessionId(),
    )}`;
    const response = await fetch(statusUrl);
    const payload = await response.json();

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
      detail: `Cannot reach backend at ${backendUrl}. Start it with npm run backend.`,
    };
  }
}

export function getEmailRuntimeInfo() {
  return {
    backendUrl,
    redirectUri: `${backendUrl}/auth/google/callback`,
  };
}

async function waitForEmailConnection() {
  const attempts = 8;

  for (let index = 0; index < attempts; index += 1) {
    const result = await refreshEmailConnection();

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

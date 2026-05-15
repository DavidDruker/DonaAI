import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createDeviceAlarm,
  createDeviceReminder,
  loadCalendarSummary,
  loadReminderSummary,
  requestCalendarAccess,
  requestReminderAccess,
} from "./services/deviceAccess";
import {
  getEmailAccessSummary,
  getEmailRuntimeInfo,
  getEmailProviders,
  getGoogleSessionId,
  refreshEmailConnection,
  startEmailAuthorization,
} from "./services/emailAccess";
import {
  createGoogleCalendarEvent,
  parseAssistantPrompt,
  sendGmailMessage,
} from "./services/assistantApi";

const initialConnections = {
  email: getEmailAccessSummary(),
  calendar: {
    status: "checking",
    detail: "Checking calendar permission...",
    count: 0,
  },
  reminders: {
    status: "checking",
    detail: "Checking reminders permission...",
    count: 0,
  },
};

const initialMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: "Hi David. I can chat, answer questions, and help with email, calendar, reminders, and alarm-style reminders.",
  },
];

export default function SecretaryApp() {
  const [connections, setConnections] = useState(initialConnections);
  const [prompt, setPrompt] = useState("");
  const [emailConnection, setEmailConnection] = useState(null);
  const emailRuntime = getEmailRuntimeInfo();
  const [messages, setMessages] = useState(initialMessages);
  const [loadingKey, setLoadingKey] = useState("");
  const [clarificationContext, setClarificationContext] = useState(null);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    refreshDeviceAccess();
  }, []);

  async function refreshDeviceAccess() {
    setLoadingKey("refresh");
    const [calendar, reminders, email] = await Promise.all([
      loadCalendarSummary(),
      loadReminderSummary(),
      refreshEmailConnection(),
    ]);

    if (email.status === "connected") {
      setEmailConnection(email);
      appendAssistantMessage("Gmail is connected.");
    }

    setConnections({
      email: getEmailAccessSummary(email.status === "connected" ? email : emailConnection || email),
      calendar,
      reminders,
    });
    setLoadingKey("");
  }

  async function connectCalendar() {
    setLoadingKey("calendar");
    const status = await requestCalendarAccess();
    const calendar = await loadCalendarSummary();
    setConnections((current) => ({ ...current, calendar }));
    appendAssistantMessage(
      status === "granted"
        ? "Calendar access is connected."
        : "Calendar access was not granted.",
    );
    setLoadingKey("");
  }

  async function connectReminders() {
    setLoadingKey("reminders");
    const status = await requestReminderAccess();
    const reminders = await loadReminderSummary();
    setConnections((current) => ({ ...current, reminders }));
    appendAssistantMessage(
      status === "granted"
        ? "Reminders access is connected."
        : "Reminders access was not granted on this device.",
    );
    setLoadingKey("");
  }

  async function connectEmail(providerKey) {
    setLoadingKey(providerKey);
    const result = await startEmailAuthorization(providerKey);

    if (result.status === "authorized") {
      setEmailConnection(result);
      setConnections((current) => ({
        ...current,
        email: getEmailAccessSummary(result),
      }));
      appendAssistantMessage(
        `${result.providerName} authorized. Next we will add the backend token exchange and mailbox API calls.`,
      );
    } else if (result.status === "connected") {
      setEmailConnection(result);
      setConnections((current) => ({
        ...current,
        email: getEmailAccessSummary(result),
      }));
      appendAssistantMessage(
        `Gmail connected. Refresh token present: ${result.hasRefreshToken ? "yes" : "no"}.`,
      );
    } else {
      setConnections((current) => ({
        ...current,
        email: getEmailAccessSummary(result),
      }));
      appendAssistantMessage(result.detail);
    }

    setLoadingKey("");
  }

  async function submitPrompt() {
    const cleanPrompt = prompt.trim();

    if (!cleanPrompt) {
      appendAssistantMessage("Type a request first.");
      return;
    }

    const historyForBackend = messages;
    appendMessage("user", cleanPrompt);
    setLoadingKey("assistant");

    try {
      const intent = await parseAssistantPrompt(
        cleanPrompt,
        clarificationContext,
        historyForBackend,
      );

      if (intent.action === "clarification_question") {
        const priorTurns = clarificationContext?.turns || [];
        const nextTurns = clarificationContext
          ? [
              ...priorTurns,
              {
                question: clarificationContext.question,
                answer: cleanPrompt,
              },
            ]
          : [];

        setClarificationContext({
          originalPrompt: clarificationContext?.originalPrompt || cleanPrompt,
          question: intent.confirmation,
          turns: nextTurns,
        });
        appendAssistantMessage(intent.confirmation);
        setPrompt("");
        return;
      }

      if (intent.action === "chat_response") {
        setClarificationContext(null);
        appendAssistantMessage(intent.confirmation || "I can help with that.");
        setPrompt("");
        return;
      }

      if (intent.action === "create_reminder") {
        const result = await createDeviceReminder(intent);
        const reminders = await loadReminderSummary();
        setConnections((current) => ({ ...current, reminders }));
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        setPrompt("");
        return;
      }

      if (intent.action === "create_alarm") {
        const result = await createDeviceAlarm(intent);
        const reminders = await loadReminderSummary();
        setConnections((current) => ({ ...current, reminders }));
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        setPrompt("");
        return;
      }

      if (intent.action === "create_calendar_event") {
        const result = await createGoogleCalendarEvent(getGoogleSessionId(), intent);
        const calendar = await loadCalendarSummary();
        setConnections((current) => ({ ...current, calendar }));
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        setPrompt("");
        return;
      }

      if (intent.action === "send_email") {
        const result = await sendGmailMessage(getGoogleSessionId(), intent);
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        setPrompt("");
        return;
      }

      setClarificationContext(null);
      appendAssistantMessage(
        intent.detail ||
          intent.confirmation ||
          "I can chat, answer questions, and help with reminders, alarm-style reminders, Google Calendar events, and Gmail messages.",
      );
    } catch (error) {
      appendAssistantMessage("I could not reach the assistant backend. Make sure the backend is running.");
    } finally {
      setLoadingKey("");
    }
  }

  function appendAssistantMessage(text) {
    appendMessage("assistant", text);
  }

  function appendMessage(role, text) {
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        text,
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>Secretary</Text>
              <Text style={styles.title}>Connect your day.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={refreshDeviceAccess}
              style={({ pressed }) => [
                styles.refreshButton,
                pressed && styles.pressedButton,
              ]}
            >
              {loadingKey === "refresh" ? (
                <ActivityIndicator color="#f8fafc" size="small" />
              ) : (
                <Text style={styles.refreshText}>Refresh</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.chatPanel}>
            {messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))}
            {loadingKey === "assistant" ? (
              <View style={[styles.bubble, styles.assistantBubble]}>
                <ActivityIndicator color="#8ea4ff" size="small" />
              </View>
            ) : null}
          </View>

          <View style={styles.promptPanel}>
            <TextInput
              accessibilityLabel="Secretary prompt"
              multiline
              onChangeText={setPrompt}
              placeholder="Message Secretary..."
              placeholderTextColor="#707783"
              returnKeyType="default"
              style={styles.input}
              value={prompt}
            />
            <Pressable
              accessibilityRole="button"
              onPress={submitPrompt}
              style={({ pressed }) => [
                styles.sendButton,
                pressed && styles.pressedButton,
              ]}
            >
              {loadingKey === "assistant" ? (
                <ActivityIndicator color="#081018" size="small" />
              ) : (
                <Text style={styles.sendText}>Send</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.connectionList}>
            <ConnectionCard
              actionLabel="Connect"
              detail={connections.email.detail}
              emailProviders={getEmailProviders()}
              footer={
                `Backend: ${emailRuntime.backendUrl}. Google redirect: ${emailRuntime.redirectUri}`
              }
              loadingKey={loadingKey}
              onEmailPress={connectEmail}
              status={connections.email.status}
              title="Email"
            />
            <ConnectionCard
              actionLabel="Allow"
              detail={connections.calendar.detail}
              loading={loadingKey === "calendar"}
              onPress={connectCalendar}
              status={connections.calendar.status}
              title="Calendar"
            />
            <ConnectionCard
              actionLabel="Allow"
              detail={connections.reminders.detail}
              loading={loadingKey === "reminders"}
              onPress={connectReminders}
              status={connections.reminders.status}
              title="Reminders"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ConnectionCard({
  actionLabel,
  detail,
  emailProviders,
  footer,
  loading,
  loadingKey,
  onEmailPress,
  onPress,
  status,
  title,
}) {
  const connected = status === "granted" || status === "authorized";
  const blocked = status === "unsupported";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDetail}>{detail}</Text>
        </View>
        <StatusBadge status={status} />
      </View>

      {emailProviders && !connected ? (
        <View style={styles.emailButtonRow}>
          {emailProviders.map((provider) => (
            <Pressable
              accessibilityRole="button"
              key={provider.key}
              onPress={() => onEmailPress(provider.key)}
              style={({ pressed }) => [
                styles.cardButton,
                styles.emailButton,
                !provider.configured && styles.secondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              {loadingKey === provider.key ? (
                <ActivityIndicator color="#081018" size="small" />
              ) : (
                <Text
                  style={[
                    styles.cardButtonText,
                    !provider.configured && styles.secondaryButtonText,
                  ]}
                >
                  {provider.name}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      {footer ? <Text style={styles.cardFooter}>{footer}</Text> : null}

      {!emailProviders && !connected && !blocked ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.cardButton,
            pressed && styles.pressedButton,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#081018" size="small" />
          ) : (
            <Text style={styles.cardButtonText}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

function ChatBubble({ message }) {
  const isUser = message.role === "user";

  return (
    <View
      style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.assistantBubble,
      ]}
    >
      <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
        {message.text}
      </Text>
    </View>
  );
}

function StatusBadge({ status }) {
  const label = getStatusLabel(status);
  const tone = status === "granted" ? styles.badgeGood : styles.badgeNeutral;

  return (
    <View style={[styles.badge, tone]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function getStatusLabel(status) {
  if (status === "granted") {
    return "Connected";
  }

  if (status === "authorized") {
    return "Authorized";
  }

  if (status === "unsupported") {
    return "Unavailable";
  }

  if (status === "needs_oauth") {
    return "Connect";
  }

  if (status === "checking") {
    return "Checking";
  }

  return "Not connected";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#081018",
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  kicker: {
    color: "#8ea4ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  title: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4,
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: "#152133",
    borderColor: "#24344d",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 78,
    paddingHorizontal: 12,
  },
  refreshText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  promptPanel: {
    alignItems: "center",
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    padding: 10,
  },
  input: {
    color: "#f8fafc",
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 4,
    textAlignVertical: "center",
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: "#8ea4ff",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 16,
  },
  sendText: {
    color: "#081018",
    fontWeight: "900",
  },
  chatPanel: {
    gap: 10,
    minHeight: 260,
  },
  bubble: {
    borderRadius: 8,
    maxWidth: "88%",
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#8ea4ff",
  },
  bubbleText: {
    color: "#e5ecf8",
    fontSize: 14,
    lineHeight: 21,
  },
  userBubbleText: {
    color: "#081018",
    fontWeight: "700",
  },
  connectionList: {
    gap: 12,
    marginTop: 22,
  },
  card: {
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  cardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
  },
  cardDetail: {
    color: "#aeb8c8",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 230,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeGood: {
    backgroundColor: "rgba(74, 222, 128, 0.18)",
  },
  badgeNeutral: {
    backgroundColor: "rgba(142, 164, 255, 0.16)",
  },
  badgeText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "900",
  },
  cardButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 42,
  },
  emailButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  emailButton: {
    flex: 1,
    marginTop: 0,
  },
  secondaryButton: {
    backgroundColor: "#152133",
    borderColor: "#34445f",
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: "#f8fafc",
  },
  cardButtonText: {
    color: "#081018",
    fontWeight: "900",
  },
  cardFooter: {
    color: "#7f8ba0",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

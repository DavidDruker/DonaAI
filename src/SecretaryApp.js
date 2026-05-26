import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
  getEmailProviders,
  getGoogleSessionId,
  refreshEmailConnection,
  startEmailAuthorization,
} from "./services/emailAccess";
import {
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
  parseAssistantPrompt,
  sendGmailMessage,
} from "./services/assistantApi";
import {
  getCurrentSession,
  loadUserPreferences,
  onAuthStateChange,
  saveUserPreferences,
  signInAccount,
  signOutAccount,
  signUpAccount,
} from "./services/accountStore";
import {
  deleteContact,
  loadContacts,
  saveContact,
} from "./services/contactsStore";
import AuthScreen from "./components/AuthScreen";
import ConfigurationScreen from "./components/ConfigurationScreen";
import ContactsPanel from "./components/ContactsPanel";

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

const defaultPreferences = {
  name: "David",
  tone: "Direct and warm",
  workingHoursStart: "09:00",
  workingHoursEnd: "17:00",
  defaultMeetingMinutes: "30",
  emailSignoff: "Best,\nDavid",
};

function getDefaultPreferencesForName(name) {
  return {
    ...defaultPreferences,
    name,
    emailSignoff: `Best,\n${name}`,
  };
}

function getUpdatedSignoff(current, nextName) {
  const previousName = current.name || "David";
  const signoffPrefix = String(current.emailSignoff || "").split("\n")[0] || "Best,";
  const presetPrefixes = new Set(["Best,", "Thanks,", "Sincerely,", "Regards,"]);

  if (!presetPrefixes.has(signoffPrefix)) {
    return current.emailSignoff;
  }

  return `${signoffPrefix}\n${nextName || previousName}`;
}

export default function SecretaryApp() {
  const [screen, setScreen] = useState("loading");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [authMessage, setAuthMessage] = useState("");
  const [session, setSession] = useState(null);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [contacts, setContacts] = useState([]);
  const [contactsMessage, setContactsMessage] = useState("");
  const [connections, setConnections] = useState(initialConnections);
  const [prompt, setPrompt] = useState("");
  const [emailConnection, setEmailConnection] = useState(null);
  const [messages, setMessages] = useState(initialMessages);
  const [loadingKey, setLoadingKey] = useState("");
  const [clarificationContext, setClarificationContext] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollViewRef = useRef(null);

  useEffect(() => {
    bootstrapAccount();
  }, []);

  useEffect(() => {
    const subscription = onAuthStateChange((nextSession) => {
      setSession(nextSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (screen === "app") {
      refreshDeviceAccess();
    }
  }, [screen]);

  useEffect(() => {
    if (session?.user?.id) {
      refreshContacts(session.user.id);
    }
  }, [session?.user?.id]);

  async function bootstrapAccount() {
    const result = await getCurrentSession();

    if (result.error || !result.session) {
      setScreen("signup");
      return;
    }

    setSession(result.session);
    await loadAccountPreferences(result.session.user.id);
  }

  function updateAuthField(key, value) {
    setAuthForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePreference(key, value) {
    setPreferences((current) => ({
      ...current,
      [key]: value,
      ...(key === "name" ? { emailSignoff: getUpdatedSignoff(current, value) } : {}),
    }));
  }

  async function submitAuth() {
    const name = authForm.name.trim();
    const email = authForm.email.trim();
    const password = authForm.password;

    if (!email || !password || (screen === "signup" && !name)) {
      setAuthMessage("Fill in the required fields first.");
      return;
    }

    if (screen === "signup") {
      const result = await signUpAccount({
        email,
        password,
        name,
      });

      if (result.error) {
        setAuthMessage(result.error.message);
        return;
      }

      setPreferences((current) => getDefaultPreferencesForName(name || current.name));

      if (!result.session) {
        setAuthMessage("Check your email to confirm the account, then log in.");
        setScreen("login");
        return;
      }

      setSession(result.session);
      setAuthMessage("");
      setScreen("configure");
      return;
    }

    const result = await signInAccount({
      email,
      password,
    });

    if (result.error || !result.session) {
      setAuthMessage(result.error?.message || "Login failed.");
      return;
    }

    setSession(result.session);
    setAuthMessage("");
    await loadAccountPreferences(result.session.user.id);
  }

  async function completeConfiguration() {
    if (session?.user?.id) {
      const result = await saveUserPreferences(session.user.id, preferences);

      if (result.error) {
        setAuthMessage(result.error.message);
        return;
      }
    }

    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: `Hi ${preferences.name || "there"}. I can chat, answer questions, and help with email, calendar, reminders, and alarm-style reminders.`,
      },
    ]);
    setScreen("app");
    setSettingsOpen(false);
  }

  async function loadAccountPreferences(userId) {
    const result = await loadUserPreferences(userId);

    if (result.error) {
      setAuthMessage(result.error.message);
      setScreen("configure");
      return;
    }

    if (result.preferences) {
      setPreferences({
        ...defaultPreferences,
        ...result.preferences,
      });
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          text: `Hi ${result.preferences.name || "there"}. I can chat, answer questions, and help with email, calendar, reminders, and alarm-style reminders.`,
        },
      ]);
      setScreen("app");
      return;
    }

    setScreen("configure");
  }

  async function refreshContacts(userId = session?.user?.id) {
    const result = await loadContacts(userId);

    if (result.error) {
      setContactsMessage(result.error.message);
      return;
    }

    setContacts(result.contacts);
    setContactsMessage("");
  }

  async function addContact(contact) {
    if (!contact.name.trim() || !contact.email.trim()) {
      setContactsMessage("Add a contact name and email.");
      return false;
    }

    if (!session?.user?.id) {
      setContactsMessage("Log in before adding contacts.");
      return false;
    }

    const result = await saveContact(session.user.id, contact);

    if (result.error) {
      setContactsMessage(result.error.message);
      return false;
    }

    await refreshContacts(session.user.id);
    return true;
  }

  async function removeContact(contactId) {
    const result = await deleteContact(contactId);

    if (result.error) {
      setContactsMessage(result.error.message);
      return;
    }

    await refreshContacts();
  }

  async function signOut() {
    await signOutAccount();
    setSession(null);
    setAuthForm({
      name: "",
      email: "",
      password: "",
    });
    setPreferences(defaultPreferences);
    setContacts([]);
    setScreen("login");
  }

  function openConfiguration() {
    setAuthMessage("");
    setSettingsOpen(false);
    setScreen("configure");
  }

  async function refreshDeviceAccess() {
    setLoadingKey("refresh");
    const wasEmailConnected = connections.email.status === "authorized";
    const [calendar, reminders, email] = await Promise.all([
      loadCalendarSummary(),
      loadReminderSummary(),
      refreshEmailConnection(),
    ]);

    if (email.status === "connected") {
      setEmailConnection(email);

      if (!wasEmailConnected) {
        appendAssistantMessage("Gmail is connected.");
      }
    } else {
      setEmailConnection(null);
    }

    setConnections({
      email: getEmailAccessSummary(email),
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
    setPrompt("");
    setLoadingKey("assistant");

    try {
      const intent = await parseAssistantPrompt(
        cleanPrompt,
        clarificationContext,
        historyForBackend,
        contacts,
        preferences,
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
        return;
      }

      if (intent.action === "chat_response") {
        setClarificationContext(null);
        appendAssistantMessage(intent.confirmation || "I can help with that.");
        return;
      }

      if (intent.action === "create_reminder") {
        const result = await createDeviceReminder(intent);
        const reminders = await loadReminderSummary();
        setConnections((current) => ({ ...current, reminders }));
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        return;
      }

      if (intent.action === "create_alarm") {
        const result = await createDeviceAlarm(intent);
        const reminders = await loadReminderSummary();
        setConnections((current) => ({ ...current, reminders }));
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        return;
      }

      if (intent.action === "create_calendar_event") {
        const result = await createGoogleCalendarEvent(getGoogleSessionId(), intent);
        const calendar = await loadCalendarSummary();
        setConnections((current) => ({ ...current, calendar }));
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        return;
      }

      if (intent.action === "list_calendar_events") {
        const result = await listGoogleCalendarEvents(getGoogleSessionId(), intent);
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
        return;
      }

      if (intent.action === "send_email") {
        const result = await sendGmailMessage(getGoogleSessionId(), intent);
        appendAssistantMessage(result.detail);
        setClarificationContext(null);
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

  if (screen === "signup" || screen === "login") {
    return (
      <AuthScreen
        form={authForm}
        message={authMessage}
        mode={screen}
        onChange={updateAuthField}
        onSubmit={submitAuth}
        onToggleMode={() => {
          setAuthMessage("");
          setScreen(screen === "signup" ? "login" : "signup");
        }}
      />
    );
  }

  if (screen === "loading") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#8ea4ff" size="large" />
          <Text style={styles.loadingText}>Loading Dona...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === "configure") {
    return (
      <ConfigurationScreen
        message={authMessage}
        onBack={() => setScreen(session ? "app" : "signup")}
        onChange={updatePreference}
        onComplete={completeConfiguration}
        preferences={preferences}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>Secretary</Text>
              <Text style={styles.title}>Dona</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              onPress={() => setSettingsOpen((current) => !current)}
              style={({ pressed }) => [styles.menuButton, pressed && styles.pressedButton]}
            >
              <MenuIcon />
            </Pressable>
          </View>

          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.chatScrollContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            style={styles.chatScroll}
          >
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
          </ScrollView>

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
        </View>
      </KeyboardAvoidingView>
      <Modal
        animationType="fade"
        onRequestClose={() => setSettingsOpen(false)}
        transparent
        visible={settingsOpen}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            accessibilityLabel="Close settings"
            style={styles.drawerScrim}
            onPress={() => setSettingsOpen(false)}
          />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Connect</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSettingsOpen(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.closeText}>X</Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.drawerBody}
              keyboardShouldPersistTaps="handled"
            >
              <ConnectionRow
                detail={connections.email.detail}
                emailProviders={getEmailProviders()}
                loadingKey={loadingKey}
                onEmailPress={connectEmail}
                status={connections.email.status}
                title="Email"
              />
              <ConnectionRow
                actionLabel="Allow"
                detail={connections.calendar.detail}
                loading={loadingKey === "calendar"}
                onPress={connectCalendar}
                status={connections.calendar.status}
                title="Calendar"
              />
              <ConnectionRow
                actionLabel="Allow"
                detail={connections.reminders.detail}
                loading={loadingKey === "reminders"}
                onPress={connectReminders}
                status={connections.reminders.status}
                title="Reminders"
              />

              <Pressable
                accessibilityRole="button"
                onPress={refreshDeviceAccess}
                style={({ pressed }) => [
                  styles.drawerRefresh,
                  pressed && styles.pressedButton,
                ]}
              >
                {loadingKey === "refresh" ? (
                  <ActivityIndicator color="#f8fafc" size="small" />
                ) : (
                  <Text style={styles.drawerRefreshText}>Refresh status</Text>
                )}
              </Pressable>
              <ContactsPanel
                contacts={contacts}
                loading={loadingKey === "contacts"}
                message={contactsMessage}
                onDelete={removeContact}
                onSave={addContact}
              />
              <Pressable
                accessibilityRole="button"
                onPress={openConfiguration}
                style={({ pressed }) => [
                  styles.drawerSecondaryAction,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.drawerSecondaryActionText}>Edit preferences</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={signOut}
                style={({ pressed }) => [
                  styles.drawerSignOut,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.drawerSignOutText}>Log out</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ConnectionRow({
  actionLabel = "Connect",
  detail,
  emailProviders,
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
    <View style={styles.connectionRow}>
      <View style={styles.connectionRowTop}>
        <View style={[styles.statusDot, connected && styles.statusDotGood]} />
        <View style={styles.connectionTextWrap}>
          <Text style={styles.connectionTitle}>{title}</Text>
          <Text style={styles.connectionDetail}>{detail}</Text>
        </View>
        <Text style={[styles.connectionState, connected && styles.connectionStateGood]}>
          {connected ? "Connected" : blocked ? "Unavailable" : "Not connected"}
        </Text>
      </View>

      {emailProviders && !connected ? (
        <View style={styles.drawerActionRow}>
          {emailProviders.map((provider) => (
            <Pressable
              accessibilityRole="button"
              key={provider.key}
              onPress={() => onEmailPress(provider.key)}
              style={({ pressed }) => [
                styles.drawerActionButton,
                !provider.configured && styles.drawerSecondaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              {loadingKey === provider.key ? (
                <ActivityIndicator color="#081018" size="small" />
              ) : (
                <Text
                  style={[
                    styles.drawerActionText,
                    !provider.configured && styles.drawerSecondaryText,
                  ]}
                >
                  {provider.name}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}

      {!emailProviders && !connected && !blocked ? (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.drawerActionButton,
            pressed && styles.pressedButton,
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#081018" size="small" />
          ) : (
            <Text style={styles.drawerActionText}>{actionLabel}</Text>
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

function MenuIcon() {
  return (
    <View style={styles.menuIcon}>
      <View style={styles.menuLine} />
      <View style={styles.menuLine} />
      <View style={styles.menuLine} />
    </View>
  );
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
    flex: 1,
    padding: 20,
    paddingBottom: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
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
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0,
    marginTop: 4,
  },
  menuButton: {
    alignItems: "center",
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 46,
  },
  menuIcon: {
    gap: 5,
    width: 18,
  },
  menuLine: {
    backgroundColor: "#f8fafc",
    borderRadius: 2,
    height: 2,
    width: 18,
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
    padding: 10,
  },
  input: {
    color: "#f8fafc",
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 42,
    paddingHorizontal: 4,
    paddingVertical: 8,
    textAlignVertical: "top",
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
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    paddingBottom: 14,
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
    marginTop: 12,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  drawerScrim: {
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    flex: 1,
  },
  drawer: {
    backgroundColor: "#081018",
    borderLeftColor: "#26364f",
    borderLeftWidth: 1,
    gap: 12,
    padding: 18,
    paddingTop: 54,
    width: 320,
  },
  drawerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  drawerBody: {
    gap: 12,
    paddingBottom: 18,
  },
  drawerTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  closeButton: {
    alignItems: "center",
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  closeText: {
    color: "#f8fafc",
    fontSize: 24,
    lineHeight: 26,
  },
  connectionRow: {
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  connectionRowTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  statusDot: {
    backgroundColor: "#7f8ba0",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusDotGood: {
    backgroundColor: "#4ade80",
  },
  connectionTextWrap: {
    flex: 1,
  },
  connectionTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  connectionDetail: {
    color: "#aeb8c8",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  connectionState: {
    color: "#aeb8c8",
    fontSize: 11,
    fontWeight: "900",
  },
  connectionStateGood: {
    color: "#4ade80",
  },
  drawerActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  drawerActionButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10,
  },
  drawerSecondaryButton: {
    backgroundColor: "#152133",
    borderColor: "#34445f",
    borderWidth: 1,
  },
  drawerSecondaryText: {
    color: "#f8fafc",
  },
  drawerActionText: {
    color: "#081018",
    fontWeight: "900",
  },
  drawerRefresh: {
    alignItems: "center",
    backgroundColor: "#152133",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 40,
  },
  drawerRefreshText: {
    color: "#f8fafc",
    fontWeight: "900",
  },
  drawerSignOut: {
    alignItems: "center",
    borderColor: "#34445f",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  drawerSecondaryAction: {
    alignItems: "center",
    backgroundColor: "#152133",
    borderColor: "#34445f",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  drawerSecondaryActionText: {
    color: "#f8fafc",
    fontWeight: "900",
  },
  drawerSignOutText: {
    color: "#f8fafc",
    fontWeight: "900",
  },
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
  },
  loadingText: {
    color: "#aeb8c8",
    fontWeight: "800",
  },
  pressedButton: {
    opacity: 0.78,
  },
});

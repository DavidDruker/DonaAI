import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LabeledInput from "./LabeledInput";
import { colors } from "../theme";

export default function AuthScreen({
  form,
  message,
  mode,
  onChange,
  onSubmit,
  onToggleMode,
}) {
  const isSignup = mode === "signup";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.authContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.authHeader}>
            <Text style={styles.kicker}>Dona AI</Text>
            <Text style={styles.authTitle}>
              {isSignup ? "Create your assistant profile." : "Welcome back."}
            </Text>
          </View>

          <View style={styles.authPanel}>
            {isSignup ? (
              <LabeledInput
                label="Name"
                onChangeText={(value) => onChange("name", value)}
                placeholder="Alex"
                value={form.name}
              />
            ) : null}
            <LabeledInput
              autoCapitalize="none"
              keyboardType="email-address"
              label="Email"
              onChangeText={(value) => onChange("email", value)}
              placeholder="you@example.com"
              value={form.email}
            />
            <LabeledInput
              label="Password"
              onChangeText={(value) => onChange("password", value)}
              placeholder="Password"
              secureTextEntry
              value={form.password}
            />

            {message ? <Text style={styles.formMessage}>{message}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isSignup ? "Continue" : "Log in"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onToggleMode}
              style={({ pressed }) => [
                styles.textButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.textButtonText}>
                {isSignup ? "I already have an account" : "Create a new account"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: colors.background,
  },
  authHeader: {
    marginBottom: 22,
  },
  kicker: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  authTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36,
    marginTop: 8,
  },
  authPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    borderTopColor: colors.accent,
    borderTopWidth: 4,
    gap: 14,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 5,
  },
  primaryButtonText: {
    color: colors.onPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  textButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  textButtonText: {
    color: colors.cyan,
    fontWeight: "800",
  },
  formMessage: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 18,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

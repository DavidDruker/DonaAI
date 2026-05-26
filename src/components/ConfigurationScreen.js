import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import LabeledInput from "./LabeledInput";
import OptionPicker from "./OptionPicker";

const toneOptions = [
  { label: "Direct", value: "Direct and warm" },
  { label: "Formal", value: "Formal and polished" },
  { label: "Casual", value: "Casual and friendly" },
  { label: "Brief", value: "Brief and practical" },
];

const startOptions = [
  { label: "8 AM", value: "08:00" },
  { label: "9 AM", value: "09:00" },
  { label: "10 AM", value: "10:00" },
  { label: "11 AM", value: "11:00" },
];

const endOptions = [
  { label: "4 PM", value: "16:00" },
  { label: "5 PM", value: "17:00" },
  { label: "6 PM", value: "18:00" },
  { label: "7 PM", value: "19:00" },
];

const durationOptions = [
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "45 min", value: "45" },
  { label: "60 min", value: "60" },
];

function getSignoffOptions(name) {
  const cleanName = name || "David";

  return [
    { label: "Best", value: `Best,\n${cleanName}` },
    { label: "Thanks", value: `Thanks,\n${cleanName}` },
    { label: "Sincerely", value: `Sincerely,\n${cleanName}` },
    { label: "Regards", value: `Regards,\n${cleanName}` },
  ];
}

export default function ConfigurationScreen({
  message,
  onBack,
  onChange,
  onComplete,
  preferences,
}) {
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
            <Text style={styles.kicker}>Setup</Text>
            <Text style={styles.authTitle}>Configure Dona.</Text>
          </View>

          <View style={styles.authPanel}>
            <LabeledInput
              label="Preferred name"
              onChangeText={(value) => onChange("name", value)}
              placeholder="David"
              value={preferences.name}
            />
            <OptionPicker
              label="Tone"
              onChange={(value) => onChange("tone", value)}
              options={toneOptions}
              value={preferences.tone}
            />
            <View style={styles.twoColumnRow}>
              <OptionPicker
                label="Start"
                onChange={(value) => onChange("workingHoursStart", value)}
                options={startOptions}
                value={preferences.workingHoursStart}
              />
              <OptionPicker
                label="End"
                onChange={(value) => onChange("workingHoursEnd", value)}
                options={endOptions}
                value={preferences.workingHoursEnd}
              />
            </View>
            <OptionPicker
              label="Default meeting minutes"
              onChange={(value) => onChange("defaultMeetingMinutes", value)}
              options={durationOptions}
              value={preferences.defaultMeetingMinutes}
            />
            <OptionPicker
              label="Email sign-off"
              onChange={(value) => onChange("emailSignoff", value)}
              options={getSignoffOptions(preferences.name)}
              value={preferences.emailSignoff}
            />

            {message ? <Text style={styles.formMessage}>{message}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={onComplete}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>Start using Dona</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onBack}
              style={({ pressed }) => [
                styles.textButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.textButtonText}>Back</Text>
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
    backgroundColor: "#081018",
  },
  keyboardView: {
    flex: 1,
  },
  authContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  authHeader: {
    marginBottom: 22,
  },
  kicker: {
    color: "#8ea4ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  authTitle: {
    color: "#f8fafc",
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36,
    marginTop: 8,
  },
  authPanel: {
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#8ea4ff",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#081018",
    fontSize: 15,
    fontWeight: "900",
  },
  textButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
  },
  textButtonText: {
    color: "#c7d2fe",
    fontWeight: "800",
  },
  formMessage: {
    color: "#fca5a5",
    fontSize: 13,
    lineHeight: 18,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

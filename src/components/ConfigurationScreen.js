import {
  useMemo,
  useState,
} from "react";
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
import OptionPicker from "./OptionPicker";
import { colors } from "../theme";

const toneOptions = [
  { label: "Direct", value: "Direct and warm" },
  { label: "Formal", value: "Formal and polished" },
  { label: "Casual", value: "Casual and friendly" },
  { label: "Brief", value: "Brief and practical" },
  { label: "Detailed", value: "Detailed and explanatory" },
  { label: "Executive", value: "Executive and concise" },
];

const formalityOptions = [
  { label: "Neutral", value: "Neutral" },
  { label: "Professional", value: "Professional" },
  { label: "Very formal", value: "Very formal" },
  { label: "Relaxed", value: "Relaxed" },
];

const emailLengthOptions = [
  { label: "Short", value: "Short" },
  { label: "Medium", value: "Medium" },
  { label: "Detailed", value: "Detailed" },
];

const emailDraftOptions = [
  { label: "Show draft", value: "preview" },
  { label: "Send directly", value: "send_immediately" },
];

const durationOptions = [
  { label: "15 min", value: "15" },
  { label: "30 min", value: "30" },
  { label: "45 min", value: "45" },
  { label: "60 min", value: "60" },
  { label: "90 min", value: "90" },
];

function getSignoffOptions(name) {
  const cleanName = name || "Alex";

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
  const [step, setStep] = useState(0);
  const signoffOptions = useMemo(
    () => getSignoffOptions(preferences.name),
    [preferences.name],
  );
  const steps = [
    {
      kicker: "Setup",
      title: "Tell Dona AI who you are.",
      content: (
        <>
          <LabeledInput
            label="Preferred name"
            onChangeText={(value) => onChange("name", value)}
            placeholder="Alex"
            value={preferences.name}
          />
          <OptionPicker
            label="Tone"
            onChange={(value) => onChange("tone", value)}
            options={toneOptions}
            value={preferences.tone}
          />
        </>
      ),
    },
    {
      kicker: "Writing",
      title: "Set email style.",
      content: (
        <>
          <OptionPicker
            label="Email formality"
            onChange={(value) => onChange("emailFormality", value)}
            options={formalityOptions}
            value={preferences.emailFormality}
          />
          <OptionPicker
            label="Email length"
            onChange={(value) => onChange("emailLength", value)}
            options={emailLengthOptions}
            value={preferences.emailLength}
          />
          <OptionPicker
            label="Email sign-off"
            onChange={(value) => onChange("emailSignoff", value)}
            options={signoffOptions}
            value={preferences.emailSignoff}
          />
          <OptionPicker
            label="Before sending email"
            onChange={(value) => onChange("emailDraftMode", value)}
            options={emailDraftOptions}
            value={preferences.emailDraftMode}
          />
        </>
      ),
    },
    {
      kicker: "Scheduling",
      title: "Choose calendar defaults.",
      content: (
        <OptionPicker
          label="Default meeting minutes"
          onChange={(value) => onChange("defaultMeetingMinutes", value)}
          options={durationOptions}
          value={preferences.defaultMeetingMinutes}
        />
      ),
    },
    {
      kicker: "Memory",
      title: "Anything else Dona AI should know?",
      content: (
        <LabeledInput
          label="Optional note"
          multiline
          onChangeText={(value) => onChange("additionalInstructions", value)}
          placeholder="Example: Prefer concise morning summaries. Ask before sending sensitive emails."
          value={preferences.additionalInstructions}
        />
      ),
    },
  ];
  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

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
            <Text style={styles.kicker}>{currentStep.kicker}</Text>
            <Text style={styles.authTitle}>{currentStep.title}</Text>
            <Text style={styles.stepText}>
              Step {step + 1} of {steps.length}
            </Text>
          </View>

          <View style={styles.authPanel}>
            {currentStep.content}

            {message ? <Text style={styles.formMessage}>{message}</Text> : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (isLastStep) {
                  onComplete();
                  return;
                }

                setStep((current) => current + 1);
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {isLastStep ? "Start using Dona AI" : "Continue"}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (step > 0) {
                  setStep((current) => current - 1);
                  return;
                }

                onBack();
              }}
              style={({ pressed }) => [
                styles.textButton,
                pressed && styles.pressedButton,
              ]}
            >
              <Text style={styles.textButtonText}>
                {step > 0 ? "Previous" : "Back"}
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
  },
  authHeader: {
    marginBottom: 22,
  },
  kicker: {
    color: colors.cyan,
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
    borderTopColor: colors.cyan,
    borderTopWidth: 3,
    gap: 14,
    padding: 16,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 16,
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
  stepText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 8,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

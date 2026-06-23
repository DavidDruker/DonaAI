import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../theme";

export default function LabeledInput({ label, style, ...inputProps }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.mutedDark}
        style={[styles.fieldInput, inputProps.multiline && styles.fieldInputMultiline]}
        textAlignVertical={inputProps.multiline ? "top" : "center"}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    gap: 7,
  },
  fieldLabel: {
    color: colors.sky,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  fieldInput: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 2,
  },
  fieldInputMultiline: {
    minHeight: 84,
    paddingTop: 11,
  },
});

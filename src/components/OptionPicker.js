import { StyleSheet, Text, View, Pressable } from "react-native";

export default function OptionPicker({ label, onChange, options, value }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.optionButton,
                selected && styles.optionButtonSelected,
                pressed && styles.pressedButton,
              ]}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  fieldLabel: {
    color: "#aeb8c8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    alignItems: "center",
    backgroundColor: "#081018",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 11,
  },
  optionButtonSelected: {
    backgroundColor: "#8ea4ff",
    borderColor: "#8ea4ff",
  },
  optionText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  optionTextSelected: {
    color: "#081018",
  },
  pressedButton: {
    opacity: 0.78,
  },
});

import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

export default function OptionPicker({ label, onChange, options, value }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);
  const useDropdown = options.length > 4;

  if (useDropdown) {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOpen((current) => !current)}
          style={({ pressed }) => [
            styles.dropdownButton,
            pressed && styles.pressedButton,
          ]}
        >
          <Text style={styles.dropdownText}>
            {selectedOption?.label || "Select"}
          </Text>
          <Text style={styles.dropdownChevron}>{open ? "^" : "v"}</Text>
        </Pressable>
        {open ? (
          <View style={styles.dropdownMenu}>
            {options.map((option) => {
              const selected = option.value === value;

              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.dropdownItem,
                    selected && styles.dropdownItemSelected,
                    pressed && styles.pressedButton,
                  ]}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      selected && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }

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
    color: colors.cyan,
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
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 11,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  optionTextSelected: {
    color: colors.onPrimary,
  },
  dropdownButton: {
    alignItems: "center",
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  dropdownText: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  dropdownChevron: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  dropdownItem: {
    borderBottomColor: colors.borderSoft,
    borderBottomWidth: 1,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  dropdownItemSelected: {
    backgroundColor: colors.primary,
  },
  dropdownItemText: {
    color: colors.text,
    fontWeight: "800",
  },
  dropdownItemTextSelected: {
    color: colors.onPrimary,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

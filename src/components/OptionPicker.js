import { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";

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
          <Text style={styles.dropdownChevron}>{open ? "▲" : "▼"}</Text>
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
  dropdownButton: {
    alignItems: "center",
    backgroundColor: "#081018",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  dropdownText: {
    color: "#f8fafc",
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  dropdownChevron: {
    color: "#8ea4ff",
    fontSize: 12,
    fontWeight: "900",
  },
  dropdownMenu: {
    backgroundColor: "#081018",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  dropdownItem: {
    borderBottomColor: "#1f2d44",
    borderBottomWidth: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dropdownItemSelected: {
    backgroundColor: "#8ea4ff",
  },
  dropdownItemText: {
    color: "#f8fafc",
    fontWeight: "800",
  },
  dropdownItemTextSelected: {
    color: "#081018",
  },
  pressedButton: {
    opacity: 0.78,
  },
});

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import LabeledInput from "./LabeledInput";
import { colors } from "../theme";

const emptyForm = {
  id: "",
  name: "",
  email: "",
  notes: "",
};

export default function ContactsPanel({
  contacts,
  loading,
  message,
  onDelete,
  onSave,
}) {
  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit() {
    const saved = await onSave(form);

    if (saved) {
      setForm(emptyForm);
      setAdding(false);
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Contacts</Text>
        <View style={styles.headerActions}>
          {loading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAdding((current) => !current)}
            style={({ pressed }) => [
              styles.addToggle,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.addToggleText}>{adding ? "Close" : "Add"}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.contactList}>
        {contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No contacts yet.</Text>
            <Text style={styles.emptyText}>
              Add people here, then ask Dona AI to email them by name.
            </Text>
          </View>
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactEmail}>{contact.email}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => onDelete(contact.id)}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      {adding ? (
        <View style={styles.addPanel}>
          <Text style={styles.addPanelTitle}>Add contact</Text>
          <LabeledInput
            label="Name"
            onChangeText={(value) => updateField("name", value)}
            placeholder="Sarah"
            value={form.name}
          />
          <LabeledInput
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => updateField("email", value)}
            placeholder="sarah@example.com"
            value={form.email}
          />
          <LabeledInput
            label="Notes"
            onChangeText={(value) => updateField("notes", value)}
            placeholder="Optional"
            value={form.notes}
          />

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <Pressable
            accessibilityRole="button"
            onPress={submit}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressedButton,
            ]}
          >
            <Text style={styles.saveButtonText}>Save contact</Text>
          </Pressable>
        </View>
      ) : message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    borderTopColor: colors.accent,
    borderTopWidth: 4,
    gap: 12,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 7,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  addToggle: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 13,
  },
  addToggleText: {
    color: colors.onAccent,
    fontWeight: "900",
  },
  addPanel: {
    backgroundColor: colors.surfaceHot,
    borderColor: colors.accentDark,
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  addPanelTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 38,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: {
    color: colors.onPrimary,
    fontWeight: "900",
  },
  contactList: {
    gap: 10,
  },
  contactRow: {
    alignItems: "center",
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftColor: colors.sky,
    borderLeftWidth: 4,
    flexDirection: "row",
    gap: 8,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  contactTextWrap: {
    flex: 1,
  },
  contactName: {
    color: colors.text,
    fontWeight: "900",
  },
  contactEmail: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 3,
  },
  deleteButton: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  deleteButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyState: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
    padding: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "900",
  },
  message: {
    color: colors.sky,
    fontSize: 12,
    lineHeight: 17,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

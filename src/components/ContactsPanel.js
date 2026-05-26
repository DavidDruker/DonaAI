import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import LabeledInput from "./LabeledInput";

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
    }
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>Contacts</Text>
        {loading ? <ActivityIndicator color="#8ea4ff" size="small" /> : null}
      </View>

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
        <Text style={styles.saveButtonText}>Add contact</Text>
      </Pressable>

      <View style={styles.contactList}>
        {contacts.length === 0 ? (
          <Text style={styles.emptyText}>No contacts yet.</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "#101a29",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  panelTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 38,
  },
  saveButtonText: {
    color: "#081018",
    fontWeight: "900",
  },
  contactList: {
    gap: 8,
  },
  contactRow: {
    alignItems: "center",
    borderColor: "#26364f",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  contactTextWrap: {
    flex: 1,
  },
  contactName: {
    color: "#f8fafc",
    fontWeight: "900",
  },
  contactEmail: {
    color: "#aeb8c8",
    fontSize: 12,
    marginTop: 3,
  },
  deleteButton: {
    borderColor: "#34445f",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  deleteButtonText: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyText: {
    color: "#7f8ba0",
    fontSize: 12,
  },
  message: {
    color: "#fca5a5",
    fontSize: 12,
    lineHeight: 17,
  },
  pressedButton: {
    opacity: 0.78,
  },
});

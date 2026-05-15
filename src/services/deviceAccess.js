import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

export async function loadCalendarSummary() {
  const availability = await Calendar.isAvailableAsync();

  if (!availability) {
    return {
      status: "unavailable",
      detail: "Calendar access is not available on this device.",
      count: 0,
    };
  }

  const permission = await Calendar.getCalendarPermissionsAsync();

  if (permission.status !== "granted") {
    return {
      status: permission.status,
      detail: "Calendar permission has not been granted.",
      count: 0,
    };
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  return {
    status: "granted",
    detail: `${calendars.length} calendars available.`,
    count: calendars.length,
  };
}

export async function requestCalendarAccess() {
  const permission = await Calendar.requestCalendarPermissionsAsync();
  return permission.status;
}

export async function loadReminderSummary() {
  if (Platform.OS !== "ios") {
    return {
      status: "unsupported",
      detail: "Device reminders are available through Expo on iOS only.",
      count: 0,
    };
  }

  const permission = await Calendar.getRemindersPermissionsAsync();

  if (permission.status !== "granted") {
    return {
      status: permission.status,
      detail: "Reminders permission has not been granted.",
      count: 0,
    };
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);

  return {
    status: "granted",
    detail: `${calendars.length} reminder lists available.`,
    count: calendars.length,
  };
}

export async function requestReminderAccess() {
  if (Platform.OS !== "ios") {
    return "unsupported";
  }

  const permission = await Calendar.requestRemindersPermissionsAsync();
  return permission.status;
}

export async function createDeviceReminder(intent) {
  if (Platform.OS !== "ios") {
    return {
      status: "unsupported",
      detail: "Device reminders can only be created on iOS in this app.",
    };
  }

  const permission = await Calendar.getRemindersPermissionsAsync();

  if (permission.status !== "granted") {
    const requested = await Calendar.requestRemindersPermissionsAsync();

    if (requested.status !== "granted") {
      return {
        status: requested.status,
        detail: "Reminders permission was not granted.",
      };
    }
  }

  const dueDate = new Date(intent.due_at);

  if (Number.isNaN(dueDate.getTime())) {
    return {
      status: "error",
      detail: "The reminder date could not be understood.",
    };
  }

  const reminderId = await Calendar.createReminderAsync(null, {
    title: intent.title,
    notes: intent.notes || "",
    dueDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    completed: false,
  });

  return {
    status: "created",
    id: reminderId,
    detail: intent.confirmation || `Reminder created: ${intent.title}`,
  };
}

export async function createDeviceAlarm(intent) {
  return createDeviceReminder({
    ...intent,
    title: intent.title || "Alarm",
    notes: intent.notes || "Alarm created by Secretary.",
    confirmation: intent.confirmation || `Alarm set: ${intent.title || "Alarm"}`,
  });
}

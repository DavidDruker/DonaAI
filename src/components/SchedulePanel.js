import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors } from "../theme";

const ranges = ["today", "week", "month"];

export default function SchedulePanel({
  detail,
  events,
  onRangeChange,
  range,
}) {
  const insights = getInsights(detail);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>Calendar summary</Text>
          <Text style={styles.title}>{getRangeLabel(range)}</Text>
        </View>
      </View>

      <View style={styles.rangeRow}>
        {ranges.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item}
            onPress={() => onRangeChange(item)}
            style={[styles.rangeButton, range === item && styles.rangeButtonActive]}
          >
            <Text style={[styles.rangeText, range === item && styles.rangeTextActive]}>
              {getRangeLabel(item)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.insightGrid}>
        {insights.length > 0 ? (
          insights.map((insight) => (
            <View key={insight.label} style={styles.insightCard}>
              <Text style={styles.insightLabel}>{insight.label}</Text>
              <Text style={styles.insightValue}>{insight.value}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No summary yet.</Text>
            <Text style={styles.emptyText}>
              Connect Gmail and choose a range to load your calendar summary.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Agenda</Text>
        <Text style={styles.sectionCount}>
          {events.length} event{events.length === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={styles.eventList}>
        {events.length > 0 ? (
          events.map((event) => <ScheduleEvent event={event} key={event.id || event.start} />)
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No events listed.</Text>
            <Text style={styles.emptyText}>
              This range is clear, or Gmail has not returned events yet.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ScheduleEvent({ event }) {
  return (
    <View style={styles.eventRow}>
      <View style={styles.eventTimeBlock}>
        <Text style={styles.eventDate}>{formatEventDate(event)}</Text>
        <Text style={styles.eventTime}>{formatEventTime(event)}</Text>
      </View>
      <View style={styles.eventBody}>
        <Text style={styles.eventTitle}>{event.title}</Text>
        {event.location ? <Text style={styles.eventMeta}>{event.location}</Text> : null}
      </View>
    </View>
  );
}

export function getRangeLabel(range) {
  if (range === "week") {
    return "Week";
  }

  if (range === "month") {
    return "Month";
  }

  return "Today";
}

function getInsights(detail) {
  const lines = String(detail || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .filter((line) => line.startsWith("Summary:") || line.includes(": "))
    .filter((line) => !line.startsWith("Agenda:") && !/^\d+\./.test(line))
    .slice(0, 4)
    .map((line) => {
      const [label, ...rest] = line.split(":");
      return {
        label: label.replace(".", ""),
        value: rest.join(":").trim() || line,
      };
    });
}

function formatEventDate(event) {
  const start = event.start ? new Date(event.start) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return event.allDay ? "All day" : "Event";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
  }).format(start);
}

function formatEventTime(event) {
  if (event.allDay) {
    return "All day";
  }

  return `${event.startLabel || ""}${event.endLabel ? ` - ${event.endLabel}` : ""}`;
}

const styles = StyleSheet.create({
  panel: {
    gap: 16,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  kicker: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 3,
  },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
  },
  rangeButton: {
    alignItems: "center",
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
  },
  rangeButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rangeText: {
    color: colors.text,
    fontWeight: "900",
  },
  rangeTextActive: {
    color: colors.onPrimary,
  },
  insightGrid: {
    gap: 8,
  },
  insightCard: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftColor: colors.cyan,
    borderLeftWidth: 4,
    gap: 5,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  insightLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  insightValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  sectionCount: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
  },
  eventList: {
    gap: 8,
  },
  eventRow: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftColor: colors.accent,
    borderLeftWidth: 4,
    flexDirection: "row",
    gap: 10,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  eventTimeBlock: {
    width: 82,
  },
  eventDate: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  eventTime: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
    marginTop: 3,
  },
  eventBody: {
    flex: 1,
  },
  eventTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 20,
  },
  eventMeta: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  emptyCard: {
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
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});

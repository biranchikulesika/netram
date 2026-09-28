import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSettings } from "../theme/settings-context";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmtDate = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

interface CustomDatePickerProps {
  visible: boolean;
  initialValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  minDate?: string;
  maxDate?: string;
}

export function CustomDatePicker({
  visible,
  initialValue,
  onSelect,
  onClose,
  minDate,
  maxDate,
}: CustomDatePickerProps) {
  const { theme } = useSettings();

  const [viewYear, setViewYear] = useState(
    () => (initialValue ? new Date(`${initialValue}T00:00:00`) : new Date()).getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    () => (initialValue ? new Date(`${initialValue}T00:00:00`) : new Date()).getMonth(),
  );
  const [selected, setSelected] = useState(initialValue);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    let initial = initialValue;
    if (minDate && initial && initial < minDate) {
      initial = minDate;
    }
    if (maxDate && initial && initial > maxDate) {
      initial = maxDate;
    }
    if (!initial && minDate) {
      initial = minDate;
    }
    const b = initial ? new Date(`${initial}T00:00:00`) : new Date();
    setViewYear(b.getFullYear());
    setViewMonth(b.getMonth());
    setSelected(initial || initialValue);
    setShowYearPicker(false);
    setYearPageStart(new Date().getFullYear() - 14);
  }, [visible, initialValue, minDate, maxDate]);

  const [yearPageStart, setYearPageStart] = useState(new Date().getFullYear() - 14);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const cells = useMemo(() => {
    const arr: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [viewYear, viewMonth, firstDay, daysInMonth]);

  const canShiftPrev = useMemo(() => {
    if (!minDate) return true;
    const minD = new Date(`${minDate}T00:00:00`);
    const prevMonthEnd = new Date(viewYear, viewMonth, 0);
    return prevMonthEnd >= minD;
  }, [minDate, viewYear, viewMonth]);

  const canShiftNext = useMemo(() => {
    if (!maxDate) return true;
    const maxD = new Date(`${maxDate}T00:00:00`);
    const nextMonthStart = new Date(viewYear, viewMonth + 1, 1);
    return nextMonthStart <= maxD;
  }, [maxDate, viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    if (delta < 0 && !canShiftPrev) return;
    if (delta > 0 && !canShiftNext) return;
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const today = fmtDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const isToday = (d: number) => fmtDate(viewYear, viewMonth, d) === today;

  const currentYear = new Date().getFullYear();
  const minSelectableYear = currentYear - 10;
  const pageYears = Array.from({ length: 16 }, (_, i) => yearPageStart + i);
  const isPast = (y: number) => y < minSelectableYear;
  const isFuture = (y: number) => y > currentYear;

  const shiftOrPage = (delta: number) => {
    if (showYearPicker) {
      setYearPageStart((s) => {
        const next = s + delta * 16;
        const min = new Date().getFullYear() - 15;
        const max = new Date().getFullYear() - 14;
        return Math.min(max, Math.max(min, next));
      });
    } else {
      shiftMonth(delta);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: theme.bgSurface }]}>
          <Text style={[styles.title, { color: theme.textMuted }]}>
            {selected
              ? new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }).toUpperCase()
              : "SELECT DATE"}
          </Text>

          <View style={styles.navRow}>
            <Pressable
              style={styles.monthLabelWrap}
              onPress={() => setShowYearPicker((v) => !v)}
              accessibilityLabel="Select year"
            >
              <Text style={[styles.monthLabel, { color: theme.textPrimary }]}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Text style={[styles.dropHint, { color: theme.textMuted }]}>{showYearPicker ? "▲" : "▼"}</Text>
            </Pressable>
            <View style={styles.navArrows}>
              <Pressable
                style={[
                  styles.navBtn,
                  { backgroundColor: theme.bgSubtle },
                  (!showYearPicker && !canShiftPrev) && { opacity: 0.3 },
                ]}
                disabled={!showYearPicker && !canShiftPrev}
                onPress={() => shiftOrPage(-1)}
                accessibilityLabel={showYearPicker ? "Previous year page" : "Previous month"}
              >
                <Text style={[styles.navArrow, { color: theme.textPrimary }]}>‹</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.navBtn,
                  { backgroundColor: theme.bgSubtle },
                  (!showYearPicker && !canShiftNext) && { opacity: 0.3 },
                ]}
                disabled={!showYearPicker && !canShiftNext}
                onPress={() => shiftOrPage(1)}
                accessibilityLabel={showYearPicker ? "Next year page" : "Next month"}
              >
                <Text style={[styles.navArrow, { color: theme.textPrimary }]}>›</Text>
              </Pressable>
            </View>
          </View>

          {showYearPicker ? (
            <View style={styles.yearGrid}>
              {pageYears.map((y) => {
                const active = y === viewYear;
                const minYear = minDate ? parseInt(minDate.slice(0, 4), 10) : minSelectableYear;
                const maxYear = maxDate ? parseInt(maxDate.slice(0, 4), 10) : currentYear;
                const disabled = isPast(y) || isFuture(y) || y < minYear || y > maxYear;
                return (
                  <Pressable
                    key={y}
                    disabled={disabled}
                    style={[
                      styles.yearCell,
                      active && !disabled && { backgroundColor: theme.navyDark },
                      disabled && { opacity: 0.35 },
                    ]}
                    onPress={() => { setViewYear(y); setShowYearPicker(false); }}
                  >
                    <Text
                      style={[styles.yearCellText, { color: active && !disabled ? "#FFFFFF" : theme.textPrimary }]}
                    >
                      {y}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.weekRow}>
                {WEEKDAYS.map((d, i) => (
                  <Text key={`${d}-${i}`} style={[styles.weekDay, { color: theme.textMuted }]}>
                    {d}
                  </Text>
                ))}
              </View>

              <View style={styles.grid}>
                {cells.map((d, i) => {
                  if (d === null) {
                    return <View key={`b-${i}`} style={styles.cell} />;
                  }
                  const cellDate = fmtDate(viewYear, viewMonth, d);
                  const isBeforeMin = minDate ? cellDate < minDate : false;
                  const isAfterMax = maxDate ? cellDate > maxDate : false;
                  const isCellDisabled = isBeforeMin || isAfterMax;
                  const isCellSelected = selected === cellDate;

                  return (
                    <Pressable
                      key={d}
                      disabled={isCellDisabled}
                      style={[
                        styles.cell,
                        isToday(d) && !isCellDisabled && styles.cellToday,
                        isCellSelected && { backgroundColor: theme.navyDark },
                        isCellDisabled && { opacity: 0.25 },
                      ]}
                      onPress={() => setSelected(cellDate)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isCellSelected ? "#FFFFFF" : isCellDisabled ? theme.textMuted : theme.textPrimary,
                          },
                          isToday(d) && !isCellSelected && !isCellDisabled && { color: theme.navyDark },
                        ]}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.footer}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[styles.footerBtnText, { color: theme.textMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (selected) {
                  onSelect(selected);
                  onClose();
                }
              }}
              hitSlop={8}
              disabled={!selected || (minDate ? selected < minDate : false) || (maxDate ? selected > maxDate : false)}
            >
              <Text
                style={[
                  styles.footerBtnText,
                  {
                    color:
                      !selected || (minDate && selected < minDate) || (maxDate && selected > maxDate)
                        ? theme.textMuted
                        : theme.navyDark,
                  },
                ]}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: 320,
    borderRadius: 12,
    padding: 16,
    paddingBottom: 14,
  },
  title: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 12,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navArrows: {
    flexDirection: "row",
    gap: 8,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  navArrow: {
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "600",
  },
  monthLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  dropHint: {
    fontSize: 8,
    fontWeight: "800",
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  yearCell: {
    width: 56,
    height: 34,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  yearCellText: {
    fontSize: 13,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekDay: {
    width: 38,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  cell: {
    width: 38,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cellToday: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#0C2A52",
  },
  dayText: {
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 20,
    marginTop: 12,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
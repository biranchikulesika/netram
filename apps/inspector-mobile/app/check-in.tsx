import { SafeAreaView, StyleSheet, Text, View } from "react-native";

/** Safe capability screen: no location claim is made without a device permission and server policy. */
export default function CheckInScreen() {
  return <SafeAreaView style={styles.safe}><View style={styles.card}><Text style={styles.title}>Field check-in</Text><Text style={styles.body}>Check-in is not recorded on this device yet.</Text><Text style={styles.body}>Netram currently has no inspector check-in/geofence API contract, no project geofence data, and this app does not include a location provider. A location result must not be guessed or represented as verified.</Text><Text style={styles.note}>When the server contract defines authorized project geofences and check-in operations, this screen can request location permission, show guidance, and submit the server-validated operation.</Text></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, padding: 16, backgroundColor: "#0f172a" }, card: { backgroundColor: "#1e293b", borderRadius: 8, padding: 16, gap: 12 }, title: { color: "#f8fafc", fontSize: 21, fontWeight: "700" }, body: { color: "#cbd5e1", lineHeight: 21 }, note: { color: "#7dd3fc", lineHeight: 20 } });

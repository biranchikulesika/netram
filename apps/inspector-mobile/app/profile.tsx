import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "./_layout";

export default function ProfileScreen() {
    const { user } = useAuth();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                        {user?.email?.charAt(0).toUpperCase() ?? "I"}
                    </Text>
                </View>

                <Text style={styles.name}>
                    {user?.email ?? "Inspector"}
                </Text>

                <Text style={styles.role}>NETRAM Inspector</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>ACCOUNT</Text>

                <View style={styles.row}>
                    <Text style={styles.label}>Email</Text>
                    <Text style={styles.value}>
                        {user?.email ?? "Not available"}
                    </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                    <Text style={styles.label}>Role</Text>
                    <Text style={styles.value}>Inspector</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionTitle}>APPLICATION</Text>

                <View style={styles.row}>
                    <Text style={styles.label}>Application</Text>
                    <Text style={styles.value}>NETRAM</Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                    <Text style={styles.label}>Version</Text>
                    <Text style={styles.value}>1.0</Text>
                </View>
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerTitle}>NETRAM</Text>
                <Text style={styles.footerText}>
                    Smart Monitoring • Evidence • Field Operations
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#071A2B",
        padding: 20,
    },

    header: {
        alignItems: "center",
        paddingTop: 20,
        paddingBottom: 28,
    },

    avatar: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: "#2563EB",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
    },

    avatarText: {
        color: "#FFFFFF",
        fontSize: 30,
        fontWeight: "800",
    },

    name: {
        color: "#F8FAFC",
        fontSize: 20,
        fontWeight: "700",
    },

    role: {
        color: "#94A3B8",
        fontSize: 14,
        marginTop: 5,
    },

    card: {
        backgroundColor: "#0D263D",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#23415A",
        padding: 18,
        marginBottom: 14,
    },

    sectionTitle: {
        color: "#14B8A6",
        fontSize: 12,
        fontWeight: "800",
        letterSpacing: 1,
        marginBottom: 16,
    },

    row: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
    },

    label: {
        color: "#94A3B8",
        fontSize: 14,
    },

    value: {
        color: "#F8FAFC",
        fontSize: 14,
        fontWeight: "600",
        flexShrink: 1,
        textAlign: "right",
    },

    divider: {
        height: 1,
        backgroundColor: "#23415A",
        marginVertical: 14,
    },

    footer: {
        alignItems: "center",
        marginTop: "auto",
        paddingVertical: 20,
    },

    footerTitle: {
        color: "#2563EB",
        fontSize: 16,
        fontWeight: "800",
        letterSpacing: 2,
    },

    footerText: {
        color: "#64748B",
        fontSize: 11,
        marginTop: 6,
        textAlign: "center",
    },
});
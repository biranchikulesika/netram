import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1e293b" },
        headerTintColor: "#f8fafc",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Netram Inspector" }} />
      <Stack.Screen name="inspections/[id]" options={{ title: "Field Inspection" }} />
    </Stack>
  );
}

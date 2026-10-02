import { Stack } from "expo-router";
import { useSettings } from "../../src/theme/settings-context";

export default function InspectionsLayout() {
  const { theme } = useSettings();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: theme.bgCanvas,
        },
      }}
    >
      <Stack.Screen name="[id]" />
    </Stack>
  );
}

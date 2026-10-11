import { Stack } from "expo-router";

// Screens for signed-out users only. Add login, sign-up, password reset, etc. here.
export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "black" } }} />;
}

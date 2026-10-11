import { Stack } from "expo-router";

// Screens for signed-in users only. The guard lives in src/app/_layout.js.
export default function PrivateLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "black" } }} />;
}

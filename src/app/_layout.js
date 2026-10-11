import "../core/polyfills";
import "../core/error";
import { Exo2_400Regular, Exo2_700Bold, useFonts } from "@expo-google-fonts/exo-2";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import SplashView from "../components/splashView";
import ContextLoader from "../providers/contextLoader";
import { ContextProvider } from "../providers/contextModule";
import SessionProvider, { useSession } from "../providers/sessionProvider";
import SmartProvider from "../providers/smartProvider";

// Provider order matters: SessionProvider uses the app context to reset it on sign-out.
export default function RootLayout() {
  useFonts({ Exo2_400Regular, Exo2_700Bold });
  return (
    <SmartProvider>
      <ContextProvider>
        <ContextLoader />
        <SessionProvider>
          <RootNavigator />
        </SessionProvider>
        <StatusBar style="auto" />
      </ContextProvider>
    </SmartProvider>
  );
}

// (private) exists only while signed in and (public) only while signed out.
// A guarded route that is not available redirects to one that is.
function RootNavigator() {
  const { status } = useSession();
  if (status === "loading") return <SplashView />;
  const signedIn = status === "signedIn";

  return (
    <Stack
      screenOptions={{
        animation: "simple_push",
        headerShown: false,
        contentStyle: { backgroundColor: "black" },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(private)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(public)" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

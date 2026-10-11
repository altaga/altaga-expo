import { useContext, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signedApiGet } from "../../core/api";
import { createGlobalStyles } from "../../core/styles";
import ContextModule from "../../providers/contextModule";
import { useSession } from "../../providers/sessionProvider";
import { useSmartSize } from "../../providers/smartProvider";

export default function Home() {
  const smartSize = useSmartSize();
  const { normalize } = smartSize;
  const GlobalStyles = createGlobalStyles(smartSize);
  const { user, signOut } = useSession();
  const { value, setPersistentValue } = useContext(ContextModule);
  const [apiResult, setApiResult] = useState(null);
  const [error, setError] = useState(null);

  const run = (action) => async () => {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e.message);
    }
  };

  const Button = ({ label, onPress }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [GlobalStyles.primaryButton, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
    >
      <Text style={GlobalStyles.buttonText}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={GlobalStyles.container}>
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.heroTitle}>Template</Text>
        <View style={{ width: normalize(12), height: normalize(12), borderRadius: 6, backgroundColor: "#D4AF37" }} />
      </View>

      <View style={[GlobalStyles.main, { padding: normalize(24), justifyContent: "center", gap: normalize(12) }]}>
        <Text style={GlobalStyles.sectionHeader}>Private route</Text>
        <Text style={[GlobalStyles.heroTitle, { fontSize: normalize(40), lineHeight: normalize(44) }]}>
          Start{"\n"}Building.
        </Text>
        <Text style={GlobalStyles.bodyText}>Signed in as {user}</Text>
        <Text style={GlobalStyles.bodyText}>Cached counter: {value.counter ?? 0}</Text>
        {apiResult && <Text style={GlobalStyles.bodyText}>API: {apiResult}</Text>}
        {error && <Text style={[GlobalStyles.bodyText, { color: "#FF453A" }]}>{error}</Text>}
      </View>

      <View style={{ padding: normalize(24), paddingBottom: normalize(40), gap: normalize(12) }}>
        <Button
          label="Call signed API"
          onPress={run(async () => setApiResult(JSON.stringify(await signedApiGet("/api/hello"))))}
        />
        <Button label="Increment cached counter" onPress={run(() => setPersistentValue({ counter: (value.counter ?? 0) + 1 }))} />
        <Button label="Sign out" onPress={run(signOut)} />
      </View>
    </SafeAreaView>
  );
}

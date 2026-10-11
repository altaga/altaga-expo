import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { borderColor, cardColor, createGlobalStyles, textSecondary, whiteColor } from "../../core/styles";
import { useSession } from "../../providers/sessionProvider";
import { useSmartSize } from "../../providers/smartProvider";

export default function SignIn() {
  const smartSize = useSmartSize();
  const { normalize } = smartSize;
  const GlobalStyles = createGlobalStyles(smartSize);
  const { signIn } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn({ name });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={GlobalStyles.container}>
      <View style={[GlobalStyles.main, { padding: normalize(24), justifyContent: "center", gap: normalize(16) }]}>
        <Text style={GlobalStyles.sectionHeader}>Public route</Text>
        <Text style={[GlobalStyles.heroTitle, { fontSize: normalize(40), lineHeight: normalize(44) }]}>Sign in.</Text>
        <TextInput
          accessibilityLabel="Name"
          placeholder="Name"
          placeholderTextColor={textSecondary}
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          autoCapitalize="none"
          style={{
            backgroundColor: cardColor,
            borderColor,
            borderWidth: 1,
            color: whiteColor,
            padding: normalize(14),
            fontSize: normalize(16),
          }}
        />
        {error && <Text style={[GlobalStyles.bodyText, { color: "#FF453A" }]}>{error}</Text>}
        <Pressable
          disabled={busy || !name}
          onPress={submit}
          style={({ pressed }) => [GlobalStyles.primaryButton, (busy || !name) && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}
        >
          <Text style={GlobalStyles.buttonText}>{busy ? "Signing in…" : "Continue"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

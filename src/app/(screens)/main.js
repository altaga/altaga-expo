import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createGlobalStyles } from "../../core/styles";
import { useSmartSize } from "../../providers/smartProvider";

export default function Main() {
  const smartSize = useSmartSize();
  const { normalize } = smartSize;
  const GlobalStyles = createGlobalStyles(smartSize);

  return (
    <SafeAreaView style={GlobalStyles.container}>
      {/* ─── Minimal Header ─── */}
      <View style={GlobalStyles.header}>
        <Text style={GlobalStyles.heroTitle}>Template</Text>
        <View style={{ width: normalize(12), height: normalize(12), borderRadius: 6, backgroundColor: "#D4AF37" }} />
      </View>

      {/* ─── Minimal Body ─── */}
      <View style={[GlobalStyles.main, { padding: normalize(24), justifyContent: 'center' }]}>
        <View style={{ gap: normalize(12) }}>
          <Text style={GlobalStyles.sectionHeader}>Welcome</Text>
          <Text style={[GlobalStyles.heroTitle, { fontSize: normalize(48), lineHeight: normalize(48) }]}>
            Start{"\n"}Building.
          </Text>
          <Text style={GlobalStyles.bodyText}>
            This is a clean, minimal starting point for your next project.
          </Text>
        </View>
      </View>

      {/* ─── Single Action ─── */}
      <View style={{ padding: normalize(24), paddingBottom: normalize(40) }}>
        <Pressable style={({ pressed }) => [
          GlobalStyles.primaryButton,
          pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }
        ]}>
          <Text style={GlobalStyles.buttonText}>Get Started</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
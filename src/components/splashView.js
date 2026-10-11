import { Image } from "expo-image";
import { View } from "react-native";
import logoSplash from "../assets/logo.png";
import { createGlobalStyles } from "../core/styles";
import { useSmartSize } from "../providers/smartProvider";

export default function SplashView() {
  const GlobalStyles = createGlobalStyles(useSmartSize());
  return (
    <View style={[GlobalStyles.container, { justifyContent: "center", alignItems: "center" }]}>
      <Image source={logoSplash} alt="Logo" contentFit="contain" style={{ width: "70%", aspectRatio: 1 }} />
    </View>
  );
}

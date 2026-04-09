import frame from "../assets/frame.png";
import { Image } from "expo-image";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Dimensions, PixelRatio, Platform, View } from "react-native";
import ToastManager from "toastify-react-native";

// 1. Create the Context
const SmartSizeContext = createContext({
  width: 0,
  height: 0,
  scale: 1,
  normalize: (size) => size,
});

// 2. Export the Hook
export const useSmartSize = () => useContext(SmartSizeContext);

export default function SmartProvider({ children }) {
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [windowDimensions, setWindowDimensions] = useState(
    Dimensions.get("window"),
  );
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setWindowDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const ratio = windowDimensions.height / windowDimensions.width;
  // Ensure the frame is only added after the component has mounted on the client.
  // This prevents hydration mismatches (React error #418) between the server and the first render.
  const isWebMobileView = isMounted ? Platform.OS === "web" && ratio < 1 : false;

  // 3. Calculate the internal "smartphone" dimensions
  // These are the dimensions the children actually see
  const internalSize = useMemo(() => {
    let width, height;
    if (!isWebMobileView) {
      width = windowDimensions.width;
      height = windowDimensions.height;
    } else {
      width = frameSize.height / 2.3179;
      height = frameSize.height * 0.7668;
    }

    // Scale primarily based on width to avoid height-distortion on vertical screens.
    const baseScale = width / 375;
    // Apply a moderation factor (0 = no scale, 1 = full linear scale) to prevent extreme sizes
    const factor = 0.4; // Adjust this value (0 to 1) to fine-tune the moderation
    const moderateScale = 1 + (baseScale - 1) * factor;
    // Clamp the scale to a safe range to prevent undersizing on tiny screens or oversizing on tablets
    const clampedScale = Math.max(0.85, Math.min(1.2, moderateScale));
    const normalize = (size) => PixelRatio.roundToNearestPixel(size * clampedScale);

    return {
      width,
      height,
      scale: clampedScale,
      normalize,
    };
  }, [frameSize, windowDimensions, isWebMobileView]);

  const handleLayout = (event) => {
    const { width, height } = event.nativeEvent.layout;
    // Optimization: Only update if the integer value changed (prevents loops)
    setFrameSize((prev) => {
      if (
        Math.round(prev.width) === Math.round(width) &&
        Math.round(prev.height) === Math.round(height)
      ) {
        return prev;
      }
      return { width, height };
    });
  };

  return (
    <SmartSizeContext.Provider value={internalSize}>
      {isWebMobileView ? (
        <React.Fragment>
          <Image
            source={frame}
            onLayout={handleLayout}
            contentFit="contain"
            style={{
              width: "auto",
              height: windowDimensions.height,
              backgroundColor: "black",
            }}
          />
          <View
            style={{
              position: "absolute",
              width: `100%`,
              height: `100%`,
              alignSelf: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: internalSize.width,
                height: "76.68%",
                alignSelf: "center",
                justifyContent: "center",
              }}
            >
              {children}
              <ToastManager style={{ width: internalSize.width }} />
            </View>
          </View>
        </React.Fragment>
      ) : (
        <View style={{ flex: 1, backgroundColor: "black" }}>
          {children}
          <ToastManager />
        </View>
      )}
    </SmartSizeContext.Provider>
  );
}

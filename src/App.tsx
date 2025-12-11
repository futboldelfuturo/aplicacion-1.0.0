import React, { useState, useRef, useEffect } from "react";
import { Animated, Dimensions, View, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import RouteNavigation, { navigationRef } from "./navigation/RouteNavigation";
import { AppProvider } from "./context/AppContext";
import { PaperProvider } from "react-native-paper";
import "react-native-get-random-values";
import IntroVideo from "./components/IntroVideo";
import {
  useFonts,
  Montserrat_700Bold,
  Montserrat_500Medium,
} from "@expo-google-fonts/montserrat";
import { Poppins_500Medium } from "@expo-google-fonts/poppins";

const { height } = Dimensions.get("window");

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const fadeAnimVideo = useRef(new Animated.Value(1)).current;
  const fadeAnimApp = useRef(new Animated.Value(0)).current;
  const slideAnimApp = useRef(new Animated.Value(height * 0.1)).current;

  const [fontsLoaded] = useFonts({
    MontserratBold: Montserrat_700Bold,
    MontserratMedium: Montserrat_500Medium,
    PoppinsMedium: Poppins_500Medium,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: "#000" }} />;
  }

  const handleIntroFinish = () => {
    Animated.parallel([
      Animated.timing(fadeAnimVideo, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimApp, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnimApp, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowIntro(false);
    });
  };

  return (
    <PaperProvider>
      <AppProvider>
        {/* Intro Video */}
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnimVideo,
            position: "absolute",
            width: "100%",
            height: "100%",
          }}
        >
          {showIntro && <IntroVideo onFinish={handleIntroFinish} />}
        </Animated.View>

        {/* App principal */}
        <Animated.View
          style={{
            flex: 1,
            opacity: fadeAnimApp,
            transform: [{ translateY: slideAnimApp }],
          }}
        >
          <NavigationContainer ref={navigationRef}>
            <RouteNavigation />
          </NavigationContainer>
        </Animated.View>
      </AppProvider>
    </PaperProvider>
  );
}

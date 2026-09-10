import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const appGroup = process.env.MODELCOMMONS_APP_GROUP?.trim();
  return {
    ...config,
    name: "ModelCommons",
    slug: "modelcommons",
    owner: "sirnejo",
    description: "Download once. Run locally. Use everywhere.",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "modelcommons",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.uvasolutions.modelcommons",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
      entitlements: {
        "com.apple.developer.kernel.extended-virtual-addressing": true,
        "com.apple.developer.kernel.increased-memory-limit": true,
        ...(appGroup
          ? {
              "com.apple.security.application-groups": [appGroup],
            }
          : {}),
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#DDF1EF",
        foregroundImage: "./assets/images/icon.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.uvasolutions.modelcommons",
      softwareKeyboardLayoutMode: "resize",
    },
    web: {
      output: "static",
      favicon: "./assets/images/icon.png",
    },
    plugins: [
      "expo-router",
      "llama.rn",
      [
        "./modules/model-commons-native/app.plugin.js",
        {
          androidHubService: true,
          iosAppGroups: appGroup ? [appGroup] : [],
          iosExposeDocumentsInFiles: true,
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/icon.png",
          imageWidth: 180,
          resizeMode: "contain",
          backgroundColor: "#F3F6F8",
          dark: { backgroundColor: "#132238" },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "20d6d082-aba2-4045-b5ca-09534aebdc4c",
      },
      modelCommons: {
        appGroupConfigured: !!appGroup,
      },
    },
  };
};

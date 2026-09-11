import type { ConfigContext, ExpoConfig } from "expo/config";

export function validateReportUrl(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("MODELCOMMONS_REPORT_URL must be a valid absolute URL.");
  }
  const localLoopback = parsed.protocol === "http:"
    && ["localhost", "127.0.0.1", "10.0.2.2"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localLoopback) {
    throw new Error("MODELCOMMONS_REPORT_URL must use HTTPS, except for a local loopback development receiver.");
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw new Error("MODELCOMMONS_REPORT_URL must not contain credentials or a URL fragment.");
  }
  return parsed.toString();
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appGroup = process.env.MODELCOMMONS_APP_GROUP?.trim();
  const storageDestination = process.env.MODELCOMMONS_IOS_STORE?.trim() || 'documents';
  if (!['documents', 'app-group'].includes(storageDestination)) throw new Error('MODELCOMMONS_IOS_STORE must be documents or app-group.');
  if (storageDestination === 'app-group' && !appGroup) throw new Error('App Group storage requires MODELCOMMONS_APP_GROUP.');
  const reportUrl = validateReportUrl(process.env.MODELCOMMONS_REPORT_URL);
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
          iosOwnerAppGroup: storageDestination === 'app-group' ? appGroup : undefined,
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
        storageDestination,
        ...(reportUrl ? { reportUrl } : {}),
      },
    },
  };
};

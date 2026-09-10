import type { ConfigContext, ExpoConfig } from "expo/config";

export function validateReportUrl(value: string | undefined, production: boolean): string | undefined {
  const candidate = value?.trim();
  if (!candidate) {
    if (production) throw new Error("MODELCOMMONS_REPORT_URL is required for production builds.");
    return undefined;
  }
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("MODELCOMMONS_REPORT_URL must be a valid absolute URL.");
  }
  const developmentLoopback = parsed.protocol === "http:"
    && ["localhost", "127.0.0.1", "10.0.2.2"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && (production || !developmentLoopback)) {
    throw new Error("MODELCOMMONS_REPORT_URL must use HTTPS (HTTP is allowed only for a local development receiver).");
  }
  if (parsed.username || parsed.password || parsed.hash) {
    throw new Error("MODELCOMMONS_REPORT_URL must not contain credentials or a URL fragment.");
  }
  return parsed.toString();
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appGroup = process.env.MODELCOMMONS_APP_GROUP?.trim();
  const production = process.env.MODELCOMMONS_PRODUCTION_BUILD === "1";
  const reportUrl = validateReportUrl(process.env.MODELCOMMONS_REPORT_URL, production);
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
        ...(reportUrl ? { reportUrl } : {}),
      },
    },
  };
};

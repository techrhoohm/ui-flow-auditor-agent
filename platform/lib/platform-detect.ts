export type Platform = {
  kind: "web" | "ios" | "android" | "reactnative" | "flutter" | "source";
  label: string;
  color: string;
};

export function detectPlatform(input: string): Platform {
  const s = input.trim();

  if (/^https?:\/\//i.test(s)) {
    return { kind: "web", label: "Web", color: "violet" };
  }

  if (/\.swift/i.test(s) || /\.(xcodeproj|xcworkspace|ipa)$/i.test(s)) {
    return { kind: "ios", label: "iOS", color: "sky" };
  }

  if (/\.dart/i.test(s) || /pubspec\.yaml/i.test(s)) {
    return { kind: "flutter", label: "Flutter", color: "teal" };
  }

  if (/\.kt$/i.test(s) || /AndroidManifest/i.test(s)) {
    return { kind: "android", label: "Android", color: "emerald" };
  }

  if (/react-native/i.test(s) || /(?:^|\/)App\.tsx$/i.test(s)) {
    return { kind: "reactnative", label: "React Native", color: "cyan" };
  }

  return { kind: "source", label: "Source", color: "zinc" };
}

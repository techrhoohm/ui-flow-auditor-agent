import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--jb-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "UX Auditor — Flow",
  description: "An auditor named Nora reviews the flows of apps you build.",
};

const designTokens = `
  :root {
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --font-mono: var(--jb-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    --accent:      #635BFF;
    --accent-soft: #635BFF14;
    --accent-ring: #635BFF33;
    --accent-fg:   #ffffff;
    --sev-high:    #E03A4C;
    --sev-med:     #D97706;
    --sev-low:     #16A34A;
  }
  html, html[data-theme="dark"] {
    --bg:           #0B0B10;
    --bg-elev:      #131319;
    --bg-sunk:      #08080C;
    --bg-canvas:    #0E0E14;
    --fg:           #F5F5F4;
    --fg-muted:     #A1A1AA;
    --fg-faint:     #6B6B75;
    --border:       #21212B;
    --border-strong:#2E2E3A;
    --hairline:     #FFFFFF10;
    --shadow-sm:    0 1px 0 #0000004d, 0 1px 2px #00000080;
    --shadow-md:    0 1px 0 #0000004d, 0 6px 24px -10px #00000099;
    --shadow-lg:    0 1px 0 #0000004d, 0 24px 60px -20px #000000cc;
    --chip-bg:      #FFFFFF0A;
    --canvas-dot:   #FFFFFF1A;
    --node-ring:    #7B73FF;
    --node-fill:    #14141B;
    --highlight:    #1A1A22;
  }
  html[data-theme="light"] {
    --bg:           #FAFAF9;
    --bg-elev:      #FFFFFF;
    --bg-sunk:      #F4F4F2;
    --bg-canvas:    #F7F7F5;
    --fg:           #0B0B12;
    --fg-muted:     #5B5B66;
    --fg-faint:     #8A8A95;
    --border:       #ECECE7;
    --border-strong:#DCDCD6;
    --hairline:     #00000010;
    --shadow-sm:    0 1px 0 #0000000a, 0 1px 2px #0000000a;
    --shadow-md:    0 1px 0 #0000000a, 0 6px 24px -10px #0000001f;
    --shadow-lg:    0 1px 0 #0000000a, 0 24px 60px -20px #00000026;
    --chip-bg:      #00000008;
    --canvas-dot:   #00000012;
    --node-ring:    #635BFF;
    --node-fill:    #FFFFFF;
    --highlight:    #FFFFFF;
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={jetbrainsMono.variable}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <head><style dangerouslySetInnerHTML={{ __html: designTokens }} /></head>
      <body>{children}</body>
    </html>
  );
}

"use client";

import type { CSSProperties, ReactNode } from "react";

type FrameProps = {
  size?: number;
  children: ReactNode;
  style?: CSSProperties;
};

function PhoneFrame({ size = 1, children, style }: FrameProps) {
  return (
    <svg
      viewBox="0 0 200 360"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient id="bezel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a22" />
          <stop offset="100%" stopColor="#0a0a10" />
        </linearGradient>
        <linearGradient id="screen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f0f17" />
          <stop offset="100%" stopColor="#06060c" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="196"
        height="356"
        rx="22"
        fill="url(#bezel)"
        stroke="#2a2a36"
        strokeWidth="1"
      />
      <rect
        x="8"
        y="10"
        width="184"
        height="340"
        rx="16"
        fill="url(#screen)"
      />
      <rect x="86" y="14" width="28" height="4" rx="2" fill="#000" />
      <g transform={`translate(8 18) scale(${size})`}>{children}</g>
    </svg>
  );
}

function StatusBar() {
  return (
    <g opacity="0.6">
      <text x="14" y="14" fontSize="8" fill="#a1a1aa" fontFamily="monospace">
        9:41
      </text>
      <rect x="156" y="8" width="14" height="6" rx="1" fill="#a1a1aa" />
      <rect x="158" y="10" width="10" height="2" fill="#0a0a10" />
    </g>
  );
}

function TabBar({ active }: { active: number }) {
  const labels = ["H", "A", "♥", "Z", "AI", "P"];
  return (
    <g transform="translate(0 300)">
      <rect x="0" y="0" width="184" height="32" fill="#0d0d15" />
      <rect x="0" y="0" width="184" height="0.5" fill="#27272a" />
      {labels.map((l, i) => {
        const x = 12 + i * 27;
        const isActive = i === active;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={12}
              r={6}
              fill="none"
              stroke={isActive ? "#a78bfa" : "#52525b"}
              strokeWidth="1"
            />
            <text
              x={x}
              y={15}
              fontSize="6"
              fill={isActive ? "#a78bfa" : "#52525b"}
              textAnchor="middle"
              fontFamily="ui-sans-serif"
            >
              {l}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function MockScreen({
  screenId,
  size,
}: {
  screenId: string;
  size?: number;
}) {
  return (
    <PhoneFrame size={size}>
      <StatusBar />
      {renderContent(screenId)}
    </PhoneFrame>
  );
}

function renderContent(id: string) {
  switch (id) {
    case "entry":
      return <EntryContent />;
    case "tab-home":
      return (
        <>
          <HomeContent />
          <TabBar active={0} />
        </>
      );
    case "tab-activity":
      return (
        <>
          <ActivityContent />
          <TabBar active={1} />
        </>
      );
    case "tab-heart":
      return (
        <>
          <HeartContent />
          <TabBar active={2} />
        </>
      );
    case "tab-sleep":
      return (
        <>
          <SleepContent />
          <TabBar active={3} />
        </>
      );
    case "tab-ai":
      return (
        <>
          <AIContent />
          <TabBar active={4} />
        </>
      );
    case "tab-profile":
      return (
        <>
          <ProfileContent />
          <TabBar active={5} />
        </>
      );
    default:
      return null;
  }
}

function EntryContent() {
  return (
    <g>
      <circle cx="92" cy="130" r="34" fill="#1f1430" stroke="#a78bfa" strokeWidth="1.2" />
      <text x="92" y="135" fontSize="20" textAnchor="middle" fill="#a78bfa" fontFamily="ui-sans-serif" fontWeight="600">
        V
      </text>
      <text x="92" y="195" fontSize="11" textAnchor="middle" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Vitals
      </text>
      <text x="92" y="208" fontSize="6" textAnchor="middle" fill="#71717a" fontFamily="ui-sans-serif">
        loading your day
      </text>
      <rect x="60" y="240" width="64" height="2" rx="1" fill="#27272a" />
      <rect x="60" y="240" width="32" height="2" rx="1" fill="#a78bfa" />
    </g>
  );
}

function HomeContent() {
  return (
    <g>
      <text x="14" y="36" fontSize="9" fill="#71717a" fontFamily="ui-sans-serif">
        Good morning
      </text>
      <text x="14" y="50" fontSize="13" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Srivathson
      </text>
      <StatCard x={14} y={66} title="Steps" value="2,418" tint="#a78bfa" />
      <StatCard x={98} y={66} title="Sleep" value="7h 12m" tint="#60a5fa" />
      <StatCard x={14} y={128} title="Heart" value="64 bpm" tint="#f87171" />
      <StatCard x={98} y={128} title="Cals" value="312" tint="#fbbf24" />
      <rect x="14" y="194" width="156" height="80" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="210" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        Trend · last 7 days
      </text>
      {[10, 30, 22, 38, 28, 44, 35].map((h, i) => (
        <rect
          key={i}
          x={24 + i * 20}
          y={264 - h}
          width="10"
          height={h}
          rx="1"
          fill="#a78bfa"
          opacity={0.7}
        />
      ))}
    </g>
  );
}

function ActivityContent() {
  return (
    <g>
      <text x="14" y="36" fontSize="13" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Activity
      </text>
      <rect x="14" y="48" width="156" height="56" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="66" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        Steps today
      </text>
      <text x="22" y="86" fontSize="18" fill="#f87171" fontFamily="ui-sans-serif" fontWeight="600">
        0
      </text>
      <text x="22" y="98" fontSize="6" fill="#71717a" fontFamily="ui-sans-serif">
        of 8,000 goal
      </text>
      {[8, 22, 14, 36, 28, 18, 32, 24, 30, 18, 26, 14].map((h, i) => (
        <rect
          key={i}
          x={16 + i * 13}
          y={196 - h}
          width="8"
          height={h}
          rx="1"
          fill="#a78bfa"
          opacity={0.7}
        />
      ))}
      <line x1="14" y1="200" x2="170" y2="200" stroke="#27272a" strokeWidth="0.5" />
      <text x="14" y="218" fontSize="6" fill="#52525b" fontFamily="monospace">
        Mon  Tue  Wed  Thu  Fri  Sat  Sun
      </text>
      <rect x="14" y="232" width="156" height="40" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="248" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        Distance
      </text>
      <text x="22" y="264" fontSize="11" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        1.4 km
      </text>
    </g>
  );
}

function HeartContent() {
  return (
    <g>
      <text x="14" y="36" fontSize="13" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Heart
      </text>
      <rect x="14" y="48" width="156" height="58" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="66" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        Resting
      </text>
      <text x="22" y="90" fontSize="22" fill="#f87171" fontFamily="ui-sans-serif" fontWeight="600">
        64
      </text>
      <text x="56" y="90" fontSize="8" fill="#71717a" fontFamily="ui-sans-serif">
        bpm
      </text>
      <rect x="14" y="118" width="156" height="100" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="134" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        Today
      </text>
      <line x1="22" y1="200" x2="162" y2="200" stroke="#27272a" strokeWidth="0.4" />
      <line x1="22" y1="180" x2="162" y2="180" stroke="#27272a" strokeWidth="0.4" />
      <line x1="22" y1="160" x2="162" y2="160" stroke="#27272a" strokeWidth="0.4" />
      <polyline
        points="22,190 38,182 54,186 70,170 86,178 102,164 118,168 134,156 150,162 162,154"
        fill="none"
        stroke="#f87171"
        strokeWidth="1.2"
      />
      <circle cx="134" cy="156" r="2" fill="#f87171" />
      <rect x="14" y="230" width="156" height="40" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="248" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        HRV
      </text>
      <text x="22" y="262" fontSize="11" fill="#e4e4e7" fontFamily="ui-sans-serif">
        42 ms
      </text>
    </g>
  );
}

function SleepContent() {
  return (
    <g>
      <text x="14" y="36" fontSize="13" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Sleep
      </text>
      <circle
        cx="92"
        cy="130"
        r="40"
        fill="none"
        stroke="#27272a"
        strokeWidth="6"
      />
      <circle
        cx="92"
        cy="130"
        r="40"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="6"
        strokeDasharray="160 80"
        strokeLinecap="round"
        transform="rotate(-90 92 130)"
      />
      <text x="92" y="128" fontSize="14" textAnchor="middle" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        7h 12m
      </text>
      <text x="92" y="142" fontSize="6" textAnchor="middle" fill="#71717a" fontFamily="ui-sans-serif">
        last night
      </text>
      <rect x="14" y="200" width="156" height="68" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y="216" fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        Phases
      </text>
      <rect x="22" y="226" width="60" height="6" rx="1" fill="#1d4ed8" />
      <rect x="84" y="226" width="40" height="6" rx="1" fill="#60a5fa" />
      <rect x="126" y="226" width="36" height="6" rx="1" fill="#bfdbfe" />
      <text x="22" y="248" fontSize="6" fill="#71717a" fontFamily="ui-sans-serif">
        Deep · Light · REM
      </text>
      <text x="22" y="262" fontSize="9" fill="#e4e4e7" fontFamily="ui-sans-serif">
        Bedtime 11:42 PM
      </text>
    </g>
  );
}

function AIContent() {
  return (
    <g>
      <text x="14" y="36" fontSize="13" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Ask Vitals
      </text>
      <rect x="14" y="50" width="120" height="26" rx="13" fill="#15151d" stroke="#27272a" />
      <text x="22" y="66" fontSize="7" fill="#a1a1aa" fontFamily="ui-sans-serif">
        Why did my HRV drop?
      </text>
      <rect x="42" y="84" width="128" height="46" rx="10" fill="#1f1430" stroke="#a78bfa" />
      <text x="50" y="98" fontSize="6" fill="#c4b5fd" fontFamily="ui-sans-serif">
        Late caffeine after 6pm
      </text>
      <text x="50" y="108" fontSize="6" fill="#c4b5fd" fontFamily="ui-sans-serif">
        plus 28-minute deficit on
      </text>
      <text x="50" y="118" fontSize="6" fill="#c4b5fd" fontFamily="ui-sans-serif">
        deep sleep last night.
      </text>
      <rect x="14" y="142" width="80" height="26" rx="13" fill="#15151d" stroke="#27272a" />
      <text x="22" y="158" fontSize="7" fill="#a1a1aa" fontFamily="ui-sans-serif">
        Suggest a fix
      </text>
      <rect x="42" y="176" width="128" height="58" rx="10" fill="#1f1430" stroke="#a78bfa" />
      <text x="50" y="190" fontSize="6" fill="#c4b5fd" fontFamily="ui-sans-serif">
        Cut caffeine by 3pm tomor-
      </text>
      <text x="50" y="200" fontSize="6" fill="#c4b5fd" fontFamily="ui-sans-serif">
        row. Aim for 7h 45m sleep.
      </text>
      <text x="50" y="212" fontSize="6" fill="#c4b5fd" fontFamily="ui-sans-serif">
        Light walk at sunset to ▌
      </text>
      <rect x="14" y="252" width="156" height="20" rx="10" fill="#0d0d15" stroke="#27272a" />
      <text x="22" y="265" fontSize="6" fill="#52525b" fontFamily="ui-sans-serif">
        ask anything…
      </text>
    </g>
  );
}

function ProfileContent() {
  return (
    <g>
      <circle cx="92" cy="58" r="22" fill="#1f1430" stroke="#a78bfa" strokeWidth="1" />
      <text x="92" y="62" fontSize="13" textAnchor="middle" fill="#a78bfa" fontFamily="ui-sans-serif" fontWeight="600">
        S
      </text>
      <text x="92" y="92" fontSize="10" textAnchor="middle" fill="#e4e4e7" fontFamily="ui-sans-serif" fontWeight="600">
        Srivathson T
      </text>
      <text x="92" y="104" fontSize="6" textAnchor="middle" fill="#71717a" fontFamily="ui-sans-serif">
        Pro · since 2024
      </text>
      <ProfileRow y={130} label="Goals" />
      <ProfileRow y={158} label="Notifications" />
      <ProfileRow y={186} label="Connected apps" />
      <ProfileRow y={214} label="Sign out" tint="#f87171" />
      <ProfileRow y={242} label="Delete account" tint="#f87171" />
    </g>
  );
}

function StatCard({
  x,
  y,
  title,
  value,
  tint,
}: {
  x: number;
  y: number;
  title: string;
  value: string;
  tint: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width="72" height="50" rx="6" fill="#15151d" stroke="#27272a" />
      <text x={x + 8} y={y + 16} fontSize="7" fill="#71717a" fontFamily="ui-sans-serif">
        {title}
      </text>
      <text x={x + 8} y={y + 36} fontSize="13" fill={tint} fontFamily="ui-sans-serif" fontWeight="600">
        {value}
      </text>
    </g>
  );
}

function ProfileRow({
  y,
  label,
  tint = "#e4e4e7",
}: {
  y: number;
  label: string;
  tint?: string;
}) {
  return (
    <g>
      <rect x="14" y={y} width="156" height="22" rx="6" fill="#15151d" stroke="#27272a" />
      <text x="22" y={y + 14} fontSize="8" fill={tint} fontFamily="ui-sans-serif">
        {label}
      </text>
      <text x="160" y={y + 14} fontSize="9" fill="#52525b" textAnchor="end" fontFamily="ui-sans-serif">
        ›
      </text>
    </g>
  );
}

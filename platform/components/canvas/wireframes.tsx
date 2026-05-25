import type { TreeNode } from '@/lib/prototype-data';
import { Hotspot } from './screenshots';

const G = {
  high:    { fill: 'currentColor' as const, opacity: 0.78 },
  mid:     { fill: 'currentColor' as const, opacity: 0.5 },
  low:     { fill: 'currentColor' as const, opacity: 0.18 },
  faint:   { fill: 'currentColor' as const, opacity: 0.08 },
  outline: { stroke: 'currentColor' as const, strokeOpacity: 0.18, fill: 'transparent' as const },
};

function WireNav() {
  return (
    <g>
      <rect x="0" y="0" width="720" height="60" {...G.faint}/>
      <rect x="0" y="59" width="720" height="1" {...G.low}/>
      <rect x="32" y="22" width="80" height="16" rx="3" {...G.high}/>
      {[160, 232, 304, 368, 432].map((x, i) => (
        <rect key={i} x={x} y="29" width="50" height="6" rx="2" {...G.mid}/>
      ))}
      <rect x="540" y="18" width="64" height="26" rx="13" {...G.outline}/>
      <rect x="616" y="18" width="74" height="26" rx="13" {...G.high}/>
    </g>
  );
}

function HomeWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <WireNav/>
      <rect x="32" y="140" width="320" height="36" rx="4" {...G.high}/>
      <rect x="32" y="186" width="280" height="36" rx="4" {...G.high}/>
      <rect x="400" y="160" width="280" height="6" rx="2" {...G.mid}/>
      <rect x="400" y="178" width="280" height="6" rx="2" {...G.mid}/>
      <rect x="400" y="196" width="220" height="6" rx="2" {...G.mid}/>
      <rect x="32"  y="240" width="120" height="40" rx="8" {...G.high}/>
      <rect x="164" y="240" width="120" height="40" rx="8" {...G.outline}/>
      <circle cx="180" cy="500" r="120" {...G.mid}/>
      <circle cx="360" cy="500" r="130" {...G.high}/>
      <circle cx="540" cy="500" r="120" {...G.mid}/>
      <circle cx="360" cy="500" r="8" {...G.faint}/>
      {[120, 320, 520].map((x, i) => (
        <g key={i}>
          <rect x={x} y="676" width="120" height="10" rx="3" {...G.high}/>
          <rect x={x} y="694" width="160" height="6" rx="2" {...G.low}/>
        </g>
      ))}
      <rect x="0" y="760" width="720" height="1" {...G.low}/>
      <rect x="32" y="810" width="140" height="8" rx="3" {...G.mid}/>
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={32 + i*116} y="850" width={i < 5 ? 100 : 80} height="22" rx="3" {...G.low}/>
      ))}
      <rect x="32" y="932" width="380" height="28" rx="4" {...G.high}/>
      <rect x="32" y="968" width="320" height="28" rx="4" {...G.high}/>
      <rect x="32"  y="1040" width="320" height="200" rx="12" {...G.outline}/>
      <rect x="48"  y="1056" width="36" height="36" rx="9" {...G.high}/>
      <rect x="48"  y="1108" width="120" height="12" rx="3" {...G.high}/>
      <rect x="48"  y="1130" width="200" height="6" rx="2" {...G.low}/>
      <rect x="48"  y="1144" width="160" height="6" rx="2" {...G.low}/>
      <rect x="368" y="1040" width="320" height="200" rx="12" {...G.outline}/>
      <rect x="384" y="1056" width="36" height="36" rx="9" {...G.high}/>
      <rect x="384" y="1108" width="140" height="12" rx="3" {...G.high}/>
      <rect x="384" y="1130" width="220" height="6" rx="2" {...G.low}/>
      <rect x="384" y="1144" width="180" height="6" rx="2" {...G.low}/>
      <g className="hotspots">
        <Hotspot n={1} x={396} y={158} w={296} h={68} sev="high"/>
        <Hotspot n={2} x={24}  y={232} w={136} h={56} sev="med"/>
      </g>
    </svg>
  );
}

function VoiceWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <WireNav/>
      <rect x="32" y="130" width="160" height="6" rx="2" {...G.high}/>
      <rect x="32" y="160" width="500" height="28" rx="4" {...G.high}/>
      <rect x="32" y="196" width="320" height="28" rx="4" {...G.high}/>
      <rect x="32" y="240" width="400" height="8" rx="2" {...G.mid}/>
      <rect x="32" y="290" width="656" height="280" rx="16" {...G.outline}/>
      <rect x="56" y="316" width="608" height="120" rx="10" {...G.faint}/>
      {[0,1,2].map(i => (
        <rect key={i} x="76" y={344 + i*22} width={i < 2 ? 560 : 460} height="6" rx="2" {...G.mid}/>
      ))}
      {[0,1,2,3].map(i => (
        <rect key={i} x={56 + i*152} y="464" width={i === 0 ? 140 : 100} height="38" rx="8" {...G.faint}/>
      ))}
      <rect x="528" y="518" width="140" height="40" rx="8" {...G.high}/>
      <rect x="32" y="618" width="200" height="20" rx="4" {...G.high}/>
      <rect x="32" y="650" width="280" height="8" rx="2" {...G.low}/>
      {[0,1,2,3,4,5,6,7].map(i => {
        const col = i % 4, row = Math.floor(i / 4);
        const x = 32 + col * 168;
        const y = 690 + row * 160;
        return (
          <g key={i}>
            <rect x={x} y={y} width="152" height="140" rx="12" {...G.outline}/>
            <circle cx={x + 28} cy={y + 32} r="14" {...G.mid}/>
            <rect x={x + 56} y={y + 22} width="60" height="8" rx="2" {...G.high}/>
            <rect x={x + 56} y={y + 38} width="50" height="5" rx="2" {...G.low}/>
            {[...Array(16)].map((_,j) => (
              <rect key={j} x={x + 16 + j*7} y={y + 78 - ((j*3)%6)*2} width="3" height={((j*3)%6)*4 + 10} rx="1.5" {...G.low}/>
            ))}
            <rect x={x + 16} y={y + 112} width="44" height="16" rx="8" {...G.faint}/>
          </g>
        );
      })}
      <g className="hotspots">
        <Hotspot n={1} x={528} y={510} w={142} h={56} sev="high"/>
        <Hotspot n={2} x={48}  y={456} w={140} h={54} sev="med"/>
      </g>
    </svg>
  );
}

function PricingWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <WireNav/>
      <rect x="240" y="124" width="240" height="28" rx="4" {...G.high}/>
      <rect x="280" y="164" width="160" height="6" rx="2" {...G.mid}/>
      <rect x="296" y="200" width="128" height="34" rx="17" {...G.outline}/>
      <rect x="300" y="204" width="62"  height="26" rx="13" {...G.high}/>
      {([
        { x: 32,  highlight: false },
        { x: 200, highlight: false },
        { x: 368, highlight: true  },
        { x: 536, highlight: false },
      ] as Array<{ x: number; highlight: boolean }>).map((t, i) => (
        <g key={i}>
          {t.highlight && <rect x={t.x - 4} y={252} width="160" height="412" rx="18" {...G.faint}/>}
          <rect x={t.x} y={256} width="152" height="404" rx="14" {...G.outline}/>
          {t.highlight && <rect x={t.x + 36} y={244} width="80" height="22" rx="11" {...G.high}/>}
          <rect x={t.x + 20} y={290} width="60" height="10" rx="3" {...G.high}/>
          <rect x={t.x + 20} y={316} width="80" height="22" rx="3" {...G.high}/>
          <rect x={t.x + 16} y={352} width="120" height="36" rx="8" {...(t.highlight ? G.high : G.outline)}/>
          <rect x={t.x + 16} y={400} width="120" height="1" {...G.low}/>
          {[0,1,2,3].map(j => (
            <g key={j}>
              <circle cx={t.x + 26} cy={420 + j*30} r="3" {...G.mid}/>
              <rect x={t.x + 36} y={416 + j*30} width="90" height="6" rx="2" {...G.mid}/>
            </g>
          ))}
        </g>
      ))}
      <rect x="32" y="710" width="656" height="120" rx="14" {...G.high}/>
      <rect x="32" y="880" width="200" height="16" rx="4" {...G.high}/>
      <rect x="32" y="900" width="656" height="320" rx="12" {...G.outline}/>
      {[1,2,3,4,5].map(r => (
        <rect key={r} x="32" y={900 + r*50} width="656" height="1" {...G.low}/>
      ))}
      <g className="hotspots">
        <Hotspot n={1} x={364} y={232} w={156} h={440} sev="high"/>
      </g>
    </svg>
  );
}

function LoginWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <rect x="0" y="0" width="720" height="60" {...G.faint}/>
      <rect x="32" y="22" width="80" height="16" rx="3" {...G.high}/>
      <rect x="190" y="220" width="340" height="500" rx="20" {...G.outline}/>
      <rect x="280" y="260" width="160" height="22" rx="4" {...G.high}/>
      <rect x="270" y="294" width="180" height="6" rx="2" {...G.mid}/>
      <rect x="220" y="330" width="280" height="40" rx="8" {...G.outline}/>
      <rect x="220" y="378" width="280" height="40" rx="8" {...G.outline}/>
      <rect x="220" y="464" width="60" height="6" rx="2" {...G.mid}/>
      <rect x="220" y="472" width="280" height="38" rx="8" {...G.faint}/>
      <rect x="220" y="528" width="80" height="6" rx="2" {...G.mid}/>
      <rect x="220" y="536" width="280" height="38" rx="8" {...G.faint}/>
      <rect x="220" y="594" width="280" height="44" rx="8" {...G.high}/>
      <g className="hotspots">
        <Hotspot n={1} x={212} y={464} w={296} h={56} sev="med"/>
        <Hotspot n={2} x={212} y={528} w={296} h={56} sev="high"/>
      </g>
    </svg>
  );
}

function CloneWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <WireNav/>
      <rect x="32" y="100" width="200" height="6" rx="2" {...G.mid}/>
      <rect x="32" y="148" width="400" height="28" rx="4" {...G.high}/>
      <rect x="32" y="188" width="320" height="8" rx="2" {...G.mid}/>
      <rect x="32" y="230" width="436" height="280" rx="16" stroke="currentColor" strokeOpacity="0.2" fill="transparent" strokeDasharray="6 4"/>
      <rect x="220" y="278" width="60" height="60" rx="14" {...G.faint}/>
      <rect x="180" y="360" width="140" height="10" rx="3" {...G.high}/>
      <rect x="170" y="378" width="160" height="6" rx="2" {...G.mid}/>
      <rect x="190" y="420" width="120" height="36" rx="8" {...G.high}/>
      <rect x="488" y="230" width="200" height="280" rx="16" {...G.outline}/>
      {[290, 350, 410].map((y, i) => (
        <g key={i}>
          <rect x="504" y={y - 8} width="40" height="6" rx="2" {...G.mid}/>
          <rect x="504" y={y} width="168" height="32" rx="6" {...G.faint}/>
        </g>
      ))}
      <rect x="504" y="464" width="168" height="36" rx="8" {...G.high}/>
      <rect x="32" y="554" width="160" height="16" rx="4" {...G.high}/>
      {[0,1,2,3].map(i => (
        <g key={i}>
          <rect x="32" y={590 + i*80} width="656" height="64" rx="10" {...G.outline}/>
          <circle cx="64" cy={622 + i*80} r="18" {...G.mid}/>
          <rect x="100" y={616 + i*80} width="120" height="8" rx="2" {...G.high}/>
          <rect x="100" y={632 + i*80} width="180" height="6" rx="2" {...G.low}/>
        </g>
      ))}
      <g className="hotspots">
        <Hotspot n={1} x={24}  y={222} w={452} h={296} sev="med"/>
        <Hotspot n={2} x={496} y={456} w={184} h={52} sev="high"/>
      </g>
    </svg>
  );
}

function EnterpriseWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <WireNav/>
      <rect x="32" y="116" width="160" height="6" rx="2" {...G.mid}/>
      <rect x="32" y="156" width="480" height="28" rx="4" {...G.high}/>
      <rect x="32" y="194" width="380" height="8" rx="2" {...G.mid}/>
      <rect x="32" y="240" width="400" height="660" rx="16" {...G.outline}/>
      {[268, 340, 412, 484, 556].map((y, i) => (
        <g key={i}>
          <rect x="56" y={y - 8} width="80" height="6" rx="2" {...G.mid}/>
          <rect x="56" y={y + 8} width="352" height="40" rx="8" {...G.faint}/>
        </g>
      ))}
      <rect x="56" y="628" width="120" height="6" rx="2" {...G.mid}/>
      <rect x="56" y="636" width="352" height="120" rx="8" {...G.faint}/>
      <rect x="56" y="780" width="180" height="44" rx="8" {...G.high}/>
      {[0,1,2,3,4].map(i => (
        <g key={i} transform={`translate(464, ${292 + i * 78})`}>
          <rect x="0" y="0" width="20" height="20" rx="5" {...G.mid}/>
          <rect x="32" y="4" width="140" height="10" rx="2" {...G.high}/>
          <rect x="32" y="24" width="200" height="6" rx="2" {...G.low}/>
        </g>
      ))}
      <rect x="0" y="940" width="720" height="120" {...G.faint}/>
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={32 + i*112} y="996" width="92" height="22" rx="3" {...G.low}/>
      ))}
      <g className="hotspots">
        <Hotspot n={1} x={48} y={476} w={368} h={56} sev="high"/>
      </g>
    </svg>
  );
}

function LibraryWire() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%', color:'var(--fg)'}}>
      <rect x="0" y="0" width="720" height="1280" fill="var(--bg-elev)"/>
      <WireNav/>
      <rect x="32" y="130" width="200" height="6" rx="2" {...G.high}/>
      <rect x="32" y="170" width="320" height="24" rx="4" {...G.high}/>
      <rect x="32" y="220" width="240" height="40" rx="8" {...G.outline}/>
      {[0,1,2,3].map(i => (
        <rect key={i} x={288 + i*92} y="220" width="80" height="40" rx="8" {...G.faint}/>
      ))}
      {[0,1,2,3,4,5,6,7,8].map(i => {
        const col = i % 3, row = Math.floor(i / 3);
        return (
          <rect key={i} x={32 + col*220} y={290 + row*230} width="204" height="210" rx="14" {...G.outline}/>
        );
      })}
      <rect x="0" y="60" width="280" height="2" {...G.high}/>
    </svg>
  );
}

export function getWireframeForNode(node: TreeNode | null): React.ReactElement {
  if (!node) return <HomeWire/>;
  const p = node.path || '/';
  if (p === '/') return <HomeWire/>;
  if (p === '/pricing') return <PricingWire/>;
  if (p === '/pricing/enterprise') return <EnterpriseWire/>;
  if (p === '/voice') return <VoiceWire/>;
  if (p === '/voice/clone') return <CloneWire/>;
  if (p === '/voice/library') return <LibraryWire/>;
  if (p === '/login') return <LoginWire/>;
  return <HomeWire/>;
}

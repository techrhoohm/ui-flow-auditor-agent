import type { TreeNode } from '@/lib/prototype-data';

const SHARED_DEFS = (
  <defs>
    <linearGradient id="sg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A5B4FC"/><stop offset="1" stopColor="#6366F1"/></linearGradient>
    <linearGradient id="sg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDA4AF"/><stop offset="1" stopColor="#F472B6"/></linearGradient>
    <linearGradient id="sg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#86EFAC"/><stop offset="1" stopColor="#22D3EE"/></linearGradient>
    <linearGradient id="sgBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#F5F5F4"/></linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="20"/></filter>
  </defs>
);

export function Hotspot({ x, y, w, h, n, sev, label }: { x: number; y: number; w: number; h: number; n: number; sev: string; label?: string }) {
  const color = sev === 'high' ? '#E03A4C' : sev === 'med' ? '#D97706' : '#16A34A';
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="6" fill="none" stroke={color} strokeWidth="2" strokeDasharray="4 3"/>
      <circle cx={x} cy={y} r="11" fill={color}/>
      <text x={x} y={y + 4} textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="ui-monospace">{n}</text>
      {label && (<>
        <rect x={x + 14} y={y - 10} width={Math.max(80, label.length * 6.2)} height="20" rx="4" fill={color}/>
        <text x={x + 22} y={y + 4} fontSize="10" fill="#fff" fontFamily="ui-monospace" fontWeight="600">{label}</text>
      </>)}
    </g>
  );
}

function Nav({ active }: { active?: string }) {
  const items = ['Solutions', 'Products', 'Pricing', 'Docs', 'Company'];
  return (
    <g>
      <rect x="0" y="0" width="720" height="60" fill="#FFFFFF"/>
      <rect x="0" y="59" width="720" height="1" fill="#E5E7EB"/>
      <rect x="32" y="22" width="80" height="16" rx="3" fill="#0F172A"/>
      {items.map((t, i) => (
        <text key={t} x={160 + i*72} y="36" fontSize="13"
              fill={active === t ? '#0F172A' : '#475569'}
              fontFamily="system-ui">{t}</text>
      ))}
      <rect x="540" y="18" width="64" height="26" rx="13" fill="none" stroke="#CBD5E1"/>
      <text x="572" y="35" fontSize="11" fill="#0F172A" fontFamily="system-ui" textAnchor="middle">Log in</text>
      <rect x="616" y="18" width="74" height="26" rx="13" fill="#0F172A"/>
      <text x="653" y="35" fontSize="11" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Sign up</text>
    </g>
  );
}

function HomeShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <Nav/>
      <text x="32" y="160" fontSize="44" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-1.2">Bringing</text>
      <text x="32" y="208" fontSize="44" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-1.2">technology to life</text>
      <text x="400" y="172" fontSize="14" fill="#64748B" fontFamily="system-ui">Generate realistic voices, build voice</text>
      <text x="400" y="192" fontSize="14" fill="#64748B" fontFamily="system-ui">agents, and integrate audio into every</text>
      <text x="400" y="212" fontSize="14" fill="#64748B" fontFamily="system-ui">product through a single API.</text>
      <rect x="32" y="240" width="120" height="40" rx="8" fill="#0F172A"/>
      <text x="92" y="265" fontSize="13" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Get started</text>
      <rect x="164" y="240" width="120" height="40" rx="8" fill="none" stroke="#CBD5E1"/>
      <text x="224" y="265" fontSize="13" fill="#0F172A" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Contact sales</text>
      <ellipse cx="180" cy="500" rx="180" ry="180" fill="url(#sg1)" opacity="0.55" filter="url(#blur)"/>
      <circle cx="180" cy="500" r="120" fill="url(#sg1)" opacity="0.95"/>
      <ellipse cx="360" cy="500" rx="180" ry="180" fill="url(#sg2)" opacity="0.55" filter="url(#blur)"/>
      <circle cx="360" cy="500" r="130" fill="url(#sg2)"/>
      <ellipse cx="540" cy="500" rx="180" ry="180" fill="url(#sg3)" opacity="0.55" filter="url(#blur)"/>
      <circle cx="540" cy="500" r="120" fill="url(#sg3)" opacity="0.95"/>
      <circle cx="360" cy="500" r="12" fill="#FFFFFF"/>
      <circle cx="360" cy="500" r="4" fill="#0F172A"/>
      <text x="120" y="680" fontSize="14" fill="#0F172A" fontFamily="system-ui" fontWeight="600">Voice generator</text>
      <text x="120" y="700" fontSize="11" fill="#64748B" fontFamily="system-ui">Lifelike speech in 32 languages</text>
      <text x="320" y="680" fontSize="14" fill="#0F172A" fontFamily="system-ui" fontWeight="600">Conversational AI</text>
      <text x="320" y="700" fontSize="11" fill="#64748B" fontFamily="system-ui">Voice agents for production</text>
      <text x="520" y="680" fontSize="14" fill="#0F172A" fontFamily="system-ui" fontWeight="600">Voice cloning</text>
      <text x="520" y="700" fontSize="11" fill="#64748B" fontFamily="system-ui">Clone any voice in seconds</text>
      <rect x="0" y="760" width="720" height="1" fill="#E5E7EB"/>
      <text x="32" y="820" fontSize="13" fill="#94A3B8" fontFamily="system-ui" letterSpacing="2">TRUSTED BY</text>
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={32 + i*116} y="850" width={i < 5 ? 100 : 80} height="22" rx="3" fill="#E2E8F0"/>
      ))}
      <text x="32" y="940" fontSize="30" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-0.8">Two platforms built on the</text>
      <text x="32" y="976" fontSize="30" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-0.8">same model foundation</text>
      <rect x="32" y="1040" width="320" height="200" rx="12" fill="#FFFFFF" stroke="#E5E7EB"/>
      <rect x="48" y="1056" width="36" height="36" rx="9" fill="#0F172A"/>
      <text x="48" y="1116" fontSize="15" fontWeight="600" fill="#0F172A" fontFamily="system-ui">Studio</text>
      <text x="48" y="1140" fontSize="12" fill="#64748B" fontFamily="system-ui">Visual editor for every line.</text>
      <text x="48" y="1208" fontSize="12" fill="#0F172A" fontFamily="system-ui" fontWeight="500">Open Studio →</text>
      <rect x="368" y="1040" width="320" height="200" rx="12" fill="#F8FAFC" stroke="#E5E7EB"/>
      <rect x="384" y="1056" width="36" height="36" rx="9" fill="#635BFF"/>
      <text x="384" y="1116" fontSize="15" fontWeight="600" fill="#0F172A" fontFamily="system-ui">Developer API</text>
      <text x="384" y="1140" fontSize="12" fill="#64748B" fontFamily="system-ui">REST & streaming endpoints.</text>
      <text x="384" y="1208" fontSize="12" fill="#635BFF" fontFamily="system-ui" fontWeight="500">Read the docs →</text>
      <g className="hotspots">
        <Hotspot n={1} x={396} y={158} w={296} h={68} sev="high"/>
        <Hotspot n={2} x={24}  y={232} w={136} h={56} sev="med"/>
        <Hotspot n={3} x={528} y={0}   w={184} h={60} sev="high"/>
      </g>
    </svg>
  );
}

function VoiceShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <Nav active="Products"/>
      <text x="32" y="140" fontSize="11" fill="#635BFF" fontFamily="system-ui" fontWeight="600" letterSpacing="2">VOICE GENERATOR</text>
      <text x="32" y="180" fontSize="36" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-1">The most realistic AI voice</text>
      <text x="32" y="218" fontSize="36" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-1">in 32 languages</text>
      <text x="32" y="252" fontSize="14" fill="#64748B" fontFamily="system-ui">Try a voice with your own copy. No sign-up required.</text>
      <rect x="32" y="290" width="656" height="280" rx="16" fill="#FFFFFF" stroke="#E5E7EB"/>
      <rect x="56" y="316" width="608" height="120" rx="10" fill="#F8FAFC" stroke="#E2E8F0"/>
      <text x="76" y="346" fontSize="13" fill="#475569" fontFamily="system-ui">In a quiet town nestled between two mountains, a clock tower had</text>
      <text x="76" y="368" fontSize="13" fill="#475569" fontFamily="system-ui">struck thirteen for as long as anyone could remember. Children grew</text>
      <text x="76" y="390" fontSize="13" fill="#475569" fontFamily="system-ui">old; the chime kept its strange schedule. One night, the schoolteacher…</text>
      <rect x="56"  y="464" width="140" height="38" rx="8" fill="#F1F5F9" stroke="#E2E8F0"/>
      <circle cx="76" cy="483" r="10" fill="url(#sg2)"/>
      <text x="96" y="487" fontSize="12" fill="#0F172A" fontFamily="system-ui" fontWeight="500">Adam · narrative</text>
      <rect x="208" y="464" width="100" height="38" rx="8" fill="#F1F5F9" stroke="#E2E8F0"/>
      <text x="222" y="487" fontSize="12" fill="#475569" fontFamily="system-ui">English</text>
      <rect x="320" y="464" width="120" height="38" rx="8" fill="#F1F5F9" stroke="#E2E8F0"/>
      <text x="334" y="487" fontSize="12" fill="#475569" fontFamily="system-ui">Stability 0.7</text>
      <rect x="452" y="464" width="120" height="38" rx="8" fill="#F1F5F9" stroke="#E2E8F0"/>
      <text x="466" y="487" fontSize="12" fill="#475569" fontFamily="system-ui">Clarity 0.9</text>
      <rect x="528" y="518" width="140" height="40" rx="8" fill="#0F172A"/>
      <text x="598" y="543" fontSize="13" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">▶ Generate</text>
      <text x="56" y="544" fontSize="11" fill="#94A3B8" fontFamily="system-ui">312 / 5,000 characters</text>
      <text x="32" y="630" fontSize="20" fontWeight="600" fill="#0F172A" fontFamily="system-ui">Browse voices</text>
      <text x="32" y="652" fontSize="13" fill="#64748B" fontFamily="system-ui">3,200 community voices across 32 languages</text>
      {[0,1,2,3,4,5,6,7].map(i => {
        const col = i % 4, row = Math.floor(i / 4);
        const x = 32 + col * 168;
        const y = 690 + row * 160;
        const grads = ['url(#sg1)', 'url(#sg2)', 'url(#sg3)', 'url(#sg1)'];
        const names = ['Adam','Bella','Charlie','Dorothy','Ethan','Freya','George','Holly'];
        return (
          <g key={i}>
            <rect x={x} y={y} width="152" height="140" rx="12" fill="#FFFFFF" stroke="#E5E7EB"/>
            <circle cx={x + 28} cy={y + 32} r="18" fill={grads[col]}/>
            <text x={x + 56} y={y + 30} fontSize="13" fill="#0F172A" fontFamily="system-ui" fontWeight="600">{names[i]}</text>
            <text x={x + 56} y={y + 46} fontSize="10" fill="#94A3B8" fontFamily="system-ui">narrative · en</text>
            {[...Array(20)].map((_,j) => (
              <rect key={j} x={x + 16 + j*6} y={y + 80 - (j%5)*4 - 8} width="3" height={(j%5)*4 + 14} rx="1.5" fill="#CBD5E1"/>
            ))}
            <rect x={x + 16} y={y + 110} width="44" height="20" rx="10" fill="#F1F5F9"/>
            <text x={x + 38} y={y + 124} fontSize="10" fill="#475569" fontFamily="system-ui" textAnchor="middle">▶ Play</text>
          </g>
        );
      })}
      <g className="hotspots">
        <Hotspot n={1} x={528} y={510} w={142} h={56} sev="high" label="CTA below fold"/>
        <Hotspot n={2} x={48}  y={456} w={140} h={54} sev="med"/>
        <Hotspot n={3} x={24}  y={682} w={680} h={144} sev="low"/>
      </g>
    </svg>
  );
}

function CloneShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <Nav active="Products"/>
      <text x="32" y="100" fontSize="12" fill="#64748B" fontFamily="system-ui">Products / Voice / <tspan fill="#0F172A" fontWeight="500">Voice cloning</tspan></text>
      <text x="32" y="160" fontSize="32" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-0.8">Clone your voice in seconds</text>
      <text x="32" y="192" fontSize="14" fill="#64748B" fontFamily="system-ui">Upload 30 seconds of audio to create a high-fidelity replica.</text>
      <rect x="32" y="230" width="436" height="280" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeDasharray="6 4"/>
      <rect x="220" y="278" width="60" height="60" rx="14" fill="#F1F5F9"/>
      <path d="M236 308 l14 -14 l14 14 M250 294 v32" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <text x="250" y="376" fontSize="15" fill="#0F172A" fontFamily="system-ui" textAnchor="middle" fontWeight="600">Drop audio file</text>
      <text x="250" y="396" fontSize="12" fill="#64748B" fontFamily="system-ui" textAnchor="middle">.mp3, .wav, .m4a · up to 25 MB</text>
      <rect x="190" y="420" width="120" height="36" rx="8" fill="#0F172A"/>
      <text x="250" y="443" fontSize="12" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Choose file</text>
      <text x="250" y="478" fontSize="11" fill="#94A3B8" fontFamily="system-ui" textAnchor="middle">or record live</text>
      <rect x="488" y="230" width="200" height="280" rx="16" fill="#F8FAFC" stroke="#E5E7EB"/>
      <text x="504" y="258" fontSize="11" fill="#94A3B8" fontFamily="system-ui" letterSpacing="1">SETTINGS</text>
      <text x="504" y="290" fontSize="12" fill="#475569" fontFamily="system-ui">Name</text>
      <rect x="504" y="298" width="168" height="32" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>
      <text x="514" y="319" fontSize="12" fill="#0F172A" fontFamily="system-ui">My voice</text>
      <text x="504" y="350" fontSize="12" fill="#475569" fontFamily="system-ui">Accent</text>
      <rect x="504" y="358" width="168" height="32" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/>
      <text x="514" y="379" fontSize="12" fill="#0F172A" fontFamily="system-ui">Auto-detect ▾</text>
      <text x="504" y="410" fontSize="12" fill="#475569" fontFamily="system-ui">Tags</text>
      <rect x="504" y="420" width="60" height="22" rx="11" fill="#E0E7FF"/>
      <text x="534" y="435" fontSize="10" fill="#4338CA" fontFamily="system-ui" textAnchor="middle">narrative</text>
      <rect x="572" y="420" width="50" height="22" rx="11" fill="#FCE7F3"/>
      <text x="597" y="435" fontSize="10" fill="#9D174D" fontFamily="system-ui" textAnchor="middle">warm</text>
      <rect x="504" y="464" width="168" height="36" rx="8" fill="#635BFF"/>
      <text x="588" y="487" fontSize="12" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Create voice</text>
      <text x="32" y="560" fontSize="18" fontWeight="600" fill="#0F172A" fontFamily="system-ui">Your voices</text>
      <text x="640" y="560" fontSize="12" fill="#635BFF" fontFamily="system-ui" textAnchor="end" fontWeight="500">View all →</text>
      {[0,1,2,3].map(i => {
        const y = 590 + i * 80;
        const names = ['Studio · Alex','Podcast · Mara','Audiobook · K. Voss','Promo · Daniel'];
        const durs = ['1:42','2:14','0:58','3:01'];
        const grads = ['url(#sg1)','url(#sg2)','url(#sg3)','url(#sg1)'];
        return (
          <g key={i}>
            <rect x="32" y={y} width="656" height="64" rx="10" fill="#FFFFFF" stroke="#E5E7EB"/>
            <circle cx="64" cy={y + 32} r="18" fill={grads[i]}/>
            <text x="100" y={y + 28} fontSize="13" fill="#0F172A" fontFamily="system-ui" fontWeight="600">{names[i]}</text>
            <text x="100" y={y + 46} fontSize="11" fill="#94A3B8" fontFamily="system-ui">Created 2 days ago · {durs[i]}</text>
            {[...Array(30)].map((_,j) => (
              <rect key={j} x={340 + j*5} y={y + 28 - ((j*7)%6)*2} width="2.5" height={((j*7)%6)*4 + 6} rx="1" fill="#CBD5E1"/>
            ))}
            <rect x="556" y={y + 18} width="32" height="28" rx="6" fill="#F1F5F9"/>
            <text x="572" y={y + 37} fontSize="11" fill="#475569" fontFamily="system-ui" textAnchor="middle">▶</text>
            <rect x="596" y={y + 18} width="64" height="28" rx="6" fill="#F1F5F9"/>
            <text x="628" y={y + 37} fontSize="11" fill="#475569" fontFamily="system-ui" textAnchor="middle">Edit</text>
          </g>
        );
      })}
      <g className="hotspots">
        <Hotspot n={1} x={24}  y={222} w={452} h={296} sev="med" label="Drop zone size on mobile"/>
        <Hotspot n={2} x={496} y={456} w={184} h={52} sev="high"/>
      </g>
    </svg>
  );
}

function PricingShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <Nav active="Pricing"/>
      <text x="360" y="140" fontSize="34" fontWeight="700" fill="#0F172A" fontFamily="system-ui" textAnchor="middle" letterSpacing="-1">Plans for any scale</text>
      <text x="360" y="172" fontSize="14" fill="#64748B" fontFamily="system-ui" textAnchor="middle">Start free. Upgrade as your usage grows.</text>
      <rect x="296" y="200" width="128" height="34" rx="17" fill="#F1F5F9" stroke="#E2E8F0"/>
      <rect x="300" y="204" width="62" height="26" rx="13" fill="#FFFFFF" stroke="#CBD5E1"/>
      <text x="331" y="221" fontSize="11" fill="#0F172A" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Monthly</text>
      <text x="393" y="221" fontSize="11" fill="#94A3B8" fontFamily="system-ui" textAnchor="middle">Yearly</text>
      {([
        { x: 32,  name: 'Free',     price: '$0',   sub: 'forever',  cta: 'Get started', ctaFill: '#FFFFFF', ctaStroke: '#CBD5E1', ctaText: '#0F172A', feat: ['10,000 characters / month','Community voices','3 custom voices'] },
        { x: 200, name: 'Creator',  price: '$22',  sub: '/mo',      cta: 'Try free',   ctaFill: '#FFFFFF', ctaStroke: '#CBD5E1', ctaText: '#0F172A', feat: ['100k characters','Pro voices','30 custom voices','Commercial license'] },
        { x: 368, name: 'Pro',      price: '$99',  sub: '/mo',      cta: 'Try free',   ctaFill: '#0F172A', ctaStroke: '#0F172A', ctaText: '#FFFFFF', feat: ['500k characters','192 kbps audio','API access','Priority queue'], highlight: true },
        { x: 536, name: 'Scale',    price: '$330', sub: '/mo',      cta: 'Try free',   ctaFill: '#FFFFFF', ctaStroke: '#CBD5E1', ctaText: '#0F172A', feat: ['2M characters','Concurrency 15','HIPAA add-on','Custom voices'] },
      ] as Array<{ x: number; name: string; price: string; sub: string; cta: string; ctaFill: string; ctaStroke: string; ctaText: string; feat: string[]; highlight?: boolean }>).map((t,i) => (
        <g key={i}>
          {t.highlight && <rect x={t.x - 4} y={252} width="160" height="412" rx="18" fill="#635BFF" opacity="0.08"/>}
          <rect x={t.x} y={256} width="152" height="404" rx="14" fill="#FFFFFF" stroke={t.highlight ? '#635BFF' : '#E5E7EB'} strokeWidth={t.highlight ? 1.5 : 1}/>
          {t.highlight && (<>
            <rect x={t.x + 36} y={244} width="80" height="22" rx="11" fill="#635BFF"/>
            <text x={t.x + 76} y={259} fontSize="10" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="600">MOST POPULAR</text>
          </>)}
          <text x={t.x + 20} y={296} fontSize="14" fill="#0F172A" fontFamily="system-ui" fontWeight="600">{t.name}</text>
          <text x={t.x + 20} y={336} fontSize="28" fill="#0F172A" fontFamily="system-ui" fontWeight="700" letterSpacing="-0.6">{t.price}</text>
          <text x={t.x + 20 + (t.price.length * 16)} y={336} fontSize="13" fill="#94A3B8" fontFamily="system-ui">{t.sub}</text>
          <rect x={t.x + 16} y={352} width="120" height="36" rx="8" fill={t.ctaFill} stroke={t.ctaStroke}/>
          <text x={t.x + 76} y={375} fontSize="12" fill={t.ctaText} fontFamily="system-ui" textAnchor="middle" fontWeight="500">{t.cta}</text>
          <rect x={t.x + 16} y={400} width="120" height="1" fill="#E5E7EB"/>
          {t.feat.map((f, j) => (
            <g key={j}>
              <circle cx={t.x + 26} cy={420 + j*30} r="3" fill="#22C55E"/>
              <text x={t.x + 36} y={425 + j*30} fontSize="11" fill="#475569" fontFamily="system-ui">{f}</text>
            </g>
          ))}
        </g>
      ))}
      <rect x="32" y="710" width="656" height="120" rx="14" fill="#0F172A"/>
      <text x="56" y="752" fontSize="11" fill="#A5B4FC" fontFamily="system-ui" letterSpacing="2">ENTERPRISE</text>
      <text x="56" y="784" fontSize="20" fontWeight="700" fill="#FFFFFF" fontFamily="system-ui">Custom plan with dedicated support</text>
      <text x="56" y="808" fontSize="12" fill="#94A3B8" fontFamily="system-ui">SLA, SSO/SAML, custom data residency, and procurement-friendly contracts.</text>
      <rect x="544" y="754" width="120" height="40" rx="8" fill="#FFFFFF"/>
      <text x="604" y="779" fontSize="13" fill="#0F172A" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Talk to sales →</text>
      <text x="32" y="880" fontSize="18" fontWeight="600" fill="#0F172A" fontFamily="system-ui">Compare features</text>
      <rect x="32" y="900" width="656" height="320" rx="12" fill="#FFFFFF" stroke="#E5E7EB"/>
      {[0,1,2,3,4,5].map(r => (
        <g key={r}>
          {r > 0 && <rect x="32" y={900 + r*50} width="656" height="1" fill="#F1F5F9"/>}
          <text x="56" y={920 + r*50 + 6} fontSize="12" fill={r===0?'#94A3B8':'#0F172A'} fontFamily="system-ui" fontWeight={r===0?500:400} letterSpacing={r===0?1:0}>
            {(['CATEGORY','Characters / mo','Custom voices','Audio quality','API access','Concurrency'] as string[])[r]}
          </text>
          {[1,2,3,4].map(c => (
            <text key={c} x={224 + (c-1)*128} y={920 + r*50 + 6} fontSize="12" fill={r===0?'#94A3B8':'#475569'} fontFamily="system-ui" textAnchor="middle">
              {r===0
                ? (['Free','Creator','Pro','Scale'] as string[])[c-1]
                : (['—', '10k/100k/500k/2M', '3/30/—/Unlimited', '128/192/192/320', '—/—/✓/✓', '1/2/5/15'] as string[])[r === 1 ? c : 1].split('/')[c-1] || '·'}
            </text>
          ))}
        </g>
      ))}
      <g className="hotspots">
        <Hotspot n={1} x={364} y={232} w={156} h={440} sev="high" label="Tier card focus state"/>
        <Hotspot n={2} x={24}  y={702} w={672} h={138} sev="med"/>
      </g>
    </svg>
  );
}

function LoginShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <rect x="0" y="0" width="720" height="60" fill="#FFFFFF"/>
      <rect x="0" y="59" width="720" height="1" fill="#E5E7EB"/>
      <rect x="32" y="22" width="80" height="16" rx="3" fill="#0F172A"/>
      <text x="688" y="36" fontSize="12" fill="#64748B" fontFamily="system-ui" textAnchor="end">Need an account? <tspan fill="#635BFF" fontWeight="600">Sign up</tspan></text>
      <ellipse cx="100" cy="500" rx="240" ry="240" fill="url(#sg1)" opacity="0.25" filter="url(#blur)"/>
      <ellipse cx="620" cy="500" rx="240" ry="240" fill="url(#sg2)" opacity="0.22" filter="url(#blur)"/>
      <rect x="190" y="220" width="340" height="500" rx="20" fill="#FFFFFF" stroke="#E5E7EB"/>
      <text x="360" y="276" fontSize="22" fontWeight="700" fill="#0F172A" fontFamily="system-ui" textAnchor="middle" letterSpacing="-0.6">Welcome back</text>
      <text x="360" y="300" fontSize="13" fill="#64748B" fontFamily="system-ui" textAnchor="middle">Log in to continue building.</text>
      <rect x="220" y="330" width="280" height="40" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>
      <text x="234" y="354" fontSize="12" fill="#475569" fontFamily="system-ui">Continue with Google</text>
      <circle cx="476" cy="350" r="9" fill="#F1F5F9"/>
      <rect x="220" y="378" width="280" height="40" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>
      <text x="234" y="402" fontSize="12" fill="#475569" fontFamily="system-ui">Continue with GitHub</text>
      <circle cx="476" cy="398" r="9" fill="#F1F5F9"/>
      <rect x="220" y="430" width="280" height="1" fill="#E5E7EB"/>
      <rect x="350" y="424" width="40" height="14" fill="#FFFFFF"/>
      <text x="360" y="434" fontSize="10" fill="#94A3B8" fontFamily="system-ui" textAnchor="middle">OR</text>
      <text x="220" y="464" fontSize="11" fill="#475569" fontFamily="system-ui" fontWeight="500">Email</text>
      <rect x="220" y="472" width="280" height="38" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
      <text x="234" y="495" fontSize="12" fill="#CBD5E1" fontFamily="system-ui">you@company.com</text>
      <text x="220" y="528" fontSize="11" fill="#475569" fontFamily="system-ui" fontWeight="500">Password</text>
      <text x="500" y="528" fontSize="11" fill="#635BFF" fontFamily="system-ui" textAnchor="end" fontWeight="500">Forgot?</text>
      <rect x="220" y="536" width="280" height="38" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
      <text x="234" y="559" fontSize="14" fill="#CBD5E1" fontFamily="system-ui" letterSpacing="3">••••••••</text>
      <rect x="220" y="594" width="280" height="44" rx="8" fill="#0F172A"/>
      <text x="360" y="621" fontSize="13" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Log in</text>
      <text x="360" y="676" fontSize="11" fill="#94A3B8" fontFamily="system-ui" textAnchor="middle">By continuing you agree to our Terms and Privacy.</text>
      <g className="hotspots">
        <Hotspot n={1} x={212} y={464} w={296} h={56} sev="med" label="No autocomplete attr"/>
        <Hotspot n={2} x={212} y={528} w={296} h={56} sev="high"/>
        <Hotspot n={3} x={212} y={586} w={296} h={60} sev="high"/>
      </g>
    </svg>
  );
}

function EnterpriseShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <Nav active="Pricing"/>
      <text x="32" y="120" fontSize="12" fill="#64748B" fontFamily="system-ui">Pricing / <tspan fill="#0F172A" fontWeight="500">Enterprise</tspan></text>
      <text x="32" y="172" fontSize="34" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-1">Bring AI voice to your stack</text>
      <text x="32" y="200" fontSize="14" fill="#64748B" fontFamily="system-ui">Custom volume, SSO, SLAs, and white-glove support.</text>
      <rect x="32" y="240" width="400" height="660" rx="16" fill="#FFFFFF" stroke="#E5E7EB"/>
      {([
        { y: 268, label: 'Full name', placeholder: 'Maya Calderón' },
        { y: 340, label: 'Work email', placeholder: 'maya@company.com' },
        { y: 412, label: 'Company', placeholder: 'Acme, Inc.' },
        { y: 484, label: 'Company size', placeholder: '500–1,000', chev: true },
        { y: 556, label: 'Use case', placeholder: 'Voice agents · production launch', chev: true },
      ] as Array<{ y: number; label: string; placeholder: string; chev?: boolean }>).map((f, i) => (
        <g key={i}>
          <text x="56" y={f.y} fontSize="11" fill="#475569" fontFamily="system-ui" fontWeight="500">{f.label}</text>
          <rect x="56" y={f.y + 8} width="352" height="40" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
          <text x="72" y={f.y + 33} fontSize="12" fill={i < 3 ? '#0F172A' : '#94A3B8'} fontFamily="system-ui">{f.placeholder}</text>
          {f.chev && <text x="392" y={f.y + 33} fontSize="12" fill="#94A3B8" fontFamily="system-ui">▾</text>}
        </g>
      ))}
      <text x="56" y="628" fontSize="11" fill="#475569" fontFamily="system-ui" fontWeight="500">Tell us about your project</text>
      <rect x="56" y="636" width="352" height="120" rx="8" fill="#F8FAFC" stroke="#E2E8F0"/>
      <text x="72" y="660" fontSize="12" fill="#CBD5E1" fontFamily="system-ui">Estimated monthly volume, latency requirements,</text>
      <text x="72" y="678" fontSize="12" fill="#CBD5E1" fontFamily="system-ui">compliance constraints…</text>
      <rect x="56" y="780" width="180" height="44" rx="8" fill="#0F172A"/>
      <text x="146" y="807" fontSize="13" fill="#FFFFFF" fontFamily="system-ui" textAnchor="middle" fontWeight="500">Request demo</text>
      <text x="262" y="807" fontSize="11" fill="#94A3B8" fontFamily="system-ui">Typical response &lt; 1 business day</text>
      <text x="464" y="268" fontSize="11" fill="#94A3B8" fontFamily="system-ui" letterSpacing="2">WHAT YOU GET</text>
      {([
        { t: 'Volume-priced characters', s: 'Negotiated rate cards starting at 5M chars/mo.' },
        { t: 'Dedicated infrastructure',  s: 'Isolated tenant with concurrency guarantees.' },
        { t: 'SSO & audit logs',          s: 'SAML 2.0, SCIM provisioning, immutable logs.' },
        { t: 'Compliance',                s: 'SOC 2 Type II, GDPR, HIPAA add-on available.' },
        { t: 'Dedicated CSM',             s: 'Quarterly reviews and a shared Slack channel.' },
      ] as Array<{ t: string; s: string }>).map((b, i) => (
        <g key={i} transform={`translate(464, ${292 + i * 78})`}>
          <rect x="0" y="0" width="20" height="20" rx="5" fill="#E0E7FF"/>
          <path d="M5 10 l3 3 l7 -7" stroke="#4338CA" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          <text x="32" y="14" fontSize="13" fill="#0F172A" fontFamily="system-ui" fontWeight="600">{b.t}</text>
          <text x="32" y="34" fontSize="11" fill="#64748B" fontFamily="system-ui">{b.s}</text>
        </g>
      ))}
      <rect x="0" y="940" width="720" height="120" fill="#F8FAFC"/>
      <text x="32" y="976" fontSize="11" fill="#94A3B8" fontFamily="system-ui" letterSpacing="2">TEAMS BUILDING WITH US</text>
      {[0,1,2,3,4,5].map(i => (
        <rect key={i} x={32 + i*112} y="998" width="92" height="22" rx="3" fill="#E2E8F0"/>
      ))}
      <g className="hotspots">
        <Hotspot n={1} x={48} y={476} w={368} h={56} sev="high" label="Required label not announced"/>
        <Hotspot n={2} x={48} y={772} w={420} h={60} sev="med"/>
      </g>
    </svg>
  );
}

function LibraryShot() {
  return (
    <svg viewBox="0 0 720 1280" preserveAspectRatio="xMidYMin slice" style={{display:'block', width:'100%'}}>
      {SHARED_DEFS}
      <rect x="0" y="0" width="720" height="1280" fill="url(#sgBg)"/>
      <Nav active="Products"/>
      <text x="32" y="140" fontSize="11" fill="#635BFF" fontFamily="system-ui" fontWeight="600" letterSpacing="2">VOICE LIBRARY</text>
      <text x="32" y="180" fontSize="30" fontWeight="700" fill="#0F172A" fontFamily="system-ui" letterSpacing="-0.8">Community voices</text>
      <rect x="32" y="220" width="240" height="40" rx="8" fill="#FFFFFF" stroke="#E2E8F0"/>
      <text x="56" y="245" fontSize="12" fill="#CBD5E1" fontFamily="system-ui">Search 3,200 voices</text>
      {['Gender','Language','Accent','Use case'].map((f, i) => (
        <g key={f}>
          <rect x={288 + i*92} y="220" width="80" height="40" rx="8" fill="#F1F5F9" stroke="#E2E8F0"/>
          <text x={328 + i*92} y="245" fontSize="11" fill="#475569" fontFamily="system-ui" textAnchor="middle">{f} ▾</text>
        </g>
      ))}
      {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
        const col = i % 3, row = Math.floor(i / 3);
        const x = 32 + col * 220;
        const y = 290 + row * 230;
        return (
          <g key={i} opacity={i < 6 ? 1 : 0.5}>
            <rect x={x} y={y} width="204" height="210" rx="14" fill="#FFFFFF" stroke="#E5E7EB"/>
            <rect x={x + 16} y={y + 16} width="40" height="40" rx="20" fill="#E2E8F0"/>
            <rect x={x + 64} y={y + 22} width="100" height="10" rx="3" fill="#CBD5E1"/>
            <rect x={x + 64} y={y + 40} width="70" height="8" rx="3" fill="#E2E8F0"/>
            {[...Array(28)].map((_,j) => (
              <rect key={j} x={x + 16 + j*6} y={y + 100 - ((j*3) % 7) * 3 - 6} width="3" height={((j*3) % 7) * 6 + 12} rx="1.5" fill="#E2E8F0"/>
            ))}
            <rect x={x + 16} y={y + 156} width="60" height="22" rx="11" fill="#F1F5F9"/>
            <text x={x + 46} y={y + 171} fontSize="9" fill="#475569" fontFamily="system-ui" textAnchor="middle">▶ Preview</text>
            <rect x={x + 84} y={y + 156} width="36" height="22" rx="11" fill="#F1F5F9"/>
          </g>
        );
      })}
      <rect x="0" y="60" width="280" height="2" fill="#635BFF" opacity="0.9"/>
      <text x="32" y="92" fontSize="11" fill="#635BFF" fontFamily="system-ui" fontWeight="500">Crawling page · 40% complete</text>
    </svg>
  );
}

export function getScreenshotForNode(node: TreeNode | null): React.ReactElement {
  if (!node) return <HomeShot/>;
  const p = node.path || '/';
  if (node.status === 'crawling') return <LibraryShot/>;
  if (node.status === 'blocked') return <LoginShot/>;
  if (p === '/') return <HomeShot/>;
  if (p === '/pricing') return <PricingShot/>;
  if (p === '/pricing/enterprise') return <EnterpriseShot/>;
  if (p === '/voice') return <VoiceShot/>;
  if (p === '/voice/clone') return <CloneShot/>;
  if (p === '/voice/library') return <LibraryShot/>;
  if (p === '/login') return <LoginShot/>;
  return <HomeShot/>;
}

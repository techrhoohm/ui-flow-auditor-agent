export interface TreeNode {
  id: string;
  tag: string;
  label: string;
  path: string;
  status: 'done' | 'crawling' | 'queued' | 'blocked';
  defects: { ux: number; ui: number; a11y: number };
  children?: TreeNode[];
}

export interface HistoryItem {
  id: string;
  url: string;
  time: string;
  dur: string;
  badges: Array<{ sev: 'high' | 'med' | 'low'; count: number }>;
}

export interface Finding {
  id: string;
  sev: 'high' | 'med' | 'low';
  msg: string;
  selector?: string;
  count?: number;
  time?: string;
  cat: 'ux' | 'ui' | 'a11y';
}

export interface AgentRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: 'complete' | 'running' | 'failed';
  sites: AgentSite[];
}

export interface AgentSite {
  id: string;
  name: string;
  url: string;
  env: string;
  state: 'green' | 'amber' | 'red';
  pages: number;
  findings: number;
  tree: TreeNode;
}

export const SITE_TREE: TreeNode = {
  id: 'n0',
  tag: 'Entry',
  label: 'Home',
  path: '/',
  status: 'done',
  defects: { ux: 2, ui: 4, a11y: 3 },
  children: [
    {
      id: 'n1',
      tag: 'Marketing',
      label: 'Voice Cloning',
      path: '/voice-cloning',
      status: 'done',
      defects: { ux: 1, ui: 2, a11y: 0 },
      children: [
        {
          id: 'n1a',
          tag: 'Tool',
          label: 'Clone Studio',
          path: '/voice-cloning/studio',
          status: 'done',
          defects: { ux: 0, ui: 1, a11y: 2 },
        },
        {
          id: 'n1b',
          tag: 'Tool',
          label: 'Library',
          path: '/voice-cloning/library',
          status: 'done',
          defects: { ux: 1, ui: 0, a11y: 0 },
        },
      ],
    },
    {
      id: 'n2',
      tag: 'Pricing',
      label: 'Pricing',
      path: '/pricing',
      status: 'done',
      defects: { ux: 3, ui: 1, a11y: 1 },
    },
    {
      id: 'n3',
      tag: 'Auth',
      label: 'Sign In',
      path: '/sign-in',
      status: 'done',
      defects: { ux: 0, ui: 2, a11y: 2 },
      children: [
        {
          id: 'n3a',
          tag: 'Conversion',
          label: 'Enterprise',
          path: '/enterprise',
          status: 'done',
          defects: { ux: 1, ui: 0, a11y: 1 },
        },
      ],
    },
  ],
};

export const HISTORY: HistoryItem[] = [
  {
    id: 'h1',
    url: 'elevenlabs.io',
    time: '08:14',
    dur: '14m 03s',
    badges: [{ sev: 'high', count: 9 }, { sev: 'med', count: 14 }, { sev: 'low', count: 6 }],
  },
  {
    id: 'h2',
    url: 'nike.com',
    time: 'Yesterday',
    dur: '22m 41s',
    badges: [{ sev: 'high', count: 4 }, { sev: 'med', count: 18 }],
  },
  {
    id: 'h3',
    url: 'amazon.com',
    time: 'Mon',
    dur: '31m 12s',
    badges: [{ sev: 'high', count: 11 }, { sev: 'med', count: 7 }, { sev: 'low', count: 22 }],
  },
  {
    id: 'h4',
    url: 'officedepot.com',
    time: 'Sun',
    dur: '18m 57s',
    badges: [{ sev: 'high', count: 6 }, { sev: 'med', count: 3 }],
  },
  {
    id: 'h5',
    url: 'primitive.co',
    time: 'Fri',
    dur: '9m 22s',
    badges: [{ sev: 'low', count: 2 }],
  },
];

export const FINDINGS: Record<string, Finding[]> = {
  ux: [
    {
      id: 'fu1',
      sev: 'high',
      cat: 'ux',
      msg: 'CTA hierarchy broken — <b>two equal-weight primary buttons</b> compete for attention above the fold. Users hesitate.',
      selector: '.hero .btn-primary',
      count: 2,
      time: '08:02',
    },
    {
      id: 'fu2',
      sev: 'med',
      cat: 'ux',
      msg: 'Pricing toggle (monthly/annual) has <b>no visual feedback</b> on selection — <span class="count">3 users</span> missed the discount.',
      selector: '.pricing-toggle',
      count: 1,
      time: '08:07',
    },
  ],
  ui: [
    {
      id: 'fi1',
      sev: 'high',
      cat: 'ui',
      msg: 'Form inputs lack <b>visible focus rings</b> — keyboard users cannot determine which field is active.',
      selector: 'input, textarea, select',
      count: 14,
      time: '08:03',
    },
    {
      id: 'fi2',
      sev: 'med',
      cat: 'ui',
      msg: 'Icon-only buttons missing <b>accessible labels</b> — screen readers announce "button" with no context.',
      selector: '[aria-label]',
      count: 7,
      time: '08:09',
    },
  ],
  a11y: [
    {
      id: 'fa1',
      sev: 'high',
      cat: 'a11y',
      msg: 'Color contrast ratio <b>2.8:1</b> on ghost buttons fails WCAG AA (requires 4.5:1 for normal text).',
      selector: '.btn-ghost',
      count: 6,
      time: '08:04',
    },
    {
      id: 'fa2',
      sev: 'high',
      cat: 'a11y',
      msg: '<b>No skip navigation link</b> — keyboard users must tab through entire header on every page load.',
      selector: 'header',
      count: 1,
      time: '08:05',
    },
    {
      id: 'fa3',
      sev: 'med',
      cat: 'a11y',
      msg: 'Animated carousel has <b>no pause control</b> — violates WCAG 2.3.3 (Animation from Interactions).',
      selector: '.hero-carousel',
      count: 1,
      time: '08:11',
    },
  ],
};

export const AGENT_RUN: AgentRun = {
  id: 'run-2026-05-24-08',
  startedAt: '08:00 PT',
  finishedAt: '08:14 PT',
  status: 'complete',
  sites: [
    {
      id: 's1',
      name: 'ElevenLabs Prod',
      url: 'elevenlabs.io',
      env: 'production',
      state: 'red',
      pages: 12,
      findings: 29,
      tree: SITE_TREE,
    },
    {
      id: 's2',
      name: 'ElevenLabs Staging',
      url: 'staging.elevenlabs.io',
      env: 'staging',
      state: 'amber',
      pages: 12,
      findings: 11,
      tree: { ...SITE_TREE, id: 'sn0' },
    },
    {
      id: 's3',
      name: 'Acme Marketing',
      url: 'acme.marketing',
      env: 'production',
      state: 'green',
      pages: 6,
      findings: 2,
      tree: {
        id: 'an0',
        tag: 'Entry',
        label: 'Home',
        path: '/',
        status: 'done',
        defects: { ux: 1, ui: 1, a11y: 0 },
        children: [
          { id: 'an1', tag: 'Marketing', label: 'Features', path: '/features', status: 'done', defects: { ux: 0, ui: 0, a11y: 0 } },
          { id: 'an2', tag: 'Pricing', label: 'Pricing', path: '/pricing', status: 'done', defects: { ux: 0, ui: 1, a11y: 0 } },
        ],
      },
    },
  ],
};

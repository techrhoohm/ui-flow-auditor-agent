import type { TreeNode } from './prototype-data';

let SESSION_COUNTER = 0;

function nextSessionPrefix(): string {
  SESSION_COUNTER += 1;
  return 's' + SESSION_COUNTER + '_';
}

function withSessionIds(tree: TreeNode, prefix: string): TreeNode {
  function clone(n: TreeNode): TreeNode {
    return {
      ...n,
      id: prefix + n.id,
      children: (n.children || []).map(clone),
    };
  }
  return clone(tree);
}

export function extractHost(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return (rawUrl || '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function elevenLabsTemplate() {
  return {
    host: 'elevenlabs.io',
    label: 'ElevenLabs',
    tree: {
      id: 'n0', tag: 'Entry', label: 'Home', path: '/', status: 'queued' as const,
      defects: { ux: 2, ui: 4, a11y: 3 },
      children: [
        { id: 'n1', tag: 'Marketing', label: 'Voice Generator', path: '/voice', status: 'queued' as const,
          defects: { ux: 1, ui: 2, a11y: 5 },
          children: [
            { id: 'n4', tag: 'Tool', label: 'Voice Clone', path: '/voice/clone', status: 'queued' as const,
              defects: { ux: 0, ui: 1, a11y: 2 }, children: [] },
            { id: 'n5', tag: 'Tool', label: 'Voice Library', path: '/voice/library', status: 'queued' as const,
              defects: { ux: 0, ui: 0, a11y: 1 }, children: [] },
          ],
        },
        { id: 'n2', tag: 'Pricing', label: 'Plans', path: '/pricing', status: 'queued' as const,
          defects: { ux: 3, ui: 1, a11y: 2 },
          children: [
            { id: 'n6', tag: 'Conversion', label: 'Enterprise', path: '/pricing/enterprise', status: 'queued' as const,
              defects: { ux: 1, ui: 0, a11y: 1 }, children: [] },
          ],
        },
        { id: 'n3', tag: 'Auth', label: 'Sign in', path: '/login', status: 'queued' as const,
          defects: { ux: 0, ui: 0, a11y: 0 }, children: [] },
      ],
    },
  };
}

function nikeTemplate() {
  return {
    host: 'nike.com',
    label: 'Nike',
    tree: {
      id: 'n0', tag: 'Entry', label: 'Home', path: '/', status: 'queued' as const,
      defects: { ux: 3, ui: 5, a11y: 4 },
      children: [
        { id: 'n1', tag: 'Marketing', label: 'New & featured', path: '/new', status: 'queued' as const,
          defects: { ux: 2, ui: 1, a11y: 3 }, children: [] },
        { id: 'n2', tag: 'Shop', label: 'Men', path: '/men', status: 'queued' as const,
          defects: { ux: 1, ui: 3, a11y: 2 },
          children: [
            { id: 'n5', tag: 'Tool', label: 'Shoes', path: '/men/shoes', status: 'queued' as const,
              defects: { ux: 0, ui: 2, a11y: 4 }, children: [] },
          ],
        },
        { id: 'n3', tag: 'Shop', label: 'Women', path: '/women', status: 'queued' as const,
          defects: { ux: 1, ui: 2, a11y: 1 }, children: [] },
        { id: 'n4', tag: 'Auth', label: 'Sign in', path: '/login', status: 'queued' as const,
          defects: { ux: 1, ui: 0, a11y: 3 }, children: [] },
      ],
    },
  };
}

function amazonTemplate() {
  return {
    host: 'amazon.com',
    label: 'Amazon',
    tree: {
      id: 'n0', tag: 'Entry', label: 'Storefront', path: '/', status: 'queued' as const,
      defects: { ux: 4, ui: 6, a11y: 8 },
      children: [
        { id: 'n1', tag: 'Marketing', label: "Today's Deals", path: '/deals', status: 'queued' as const,
          defects: { ux: 2, ui: 2, a11y: 4 }, children: [] },
        { id: 'n2', tag: 'Shop', label: 'Departments', path: '/departments', status: 'queued' as const,
          defects: { ux: 1, ui: 3, a11y: 2 }, children: [] },
        { id: 'n3', tag: 'Conversion', label: 'Cart', path: '/cart', status: 'queued' as const,
          defects: { ux: 0, ui: 1, a11y: 2 }, children: [] },
        { id: 'n4', tag: 'Auth', label: 'Sign in', path: '/ap/signin', status: 'queued' as const,
          defects: { ux: 1, ui: 0, a11y: 3 }, children: [] },
      ],
    },
  };
}

function officeDepotTemplate() {
  return {
    host: 'officedepot.com',
    label: 'Office Depot',
    tree: {
      id: 'n0', tag: 'Entry', label: 'Home', path: '/', status: 'queued' as const,
      defects: { ux: 1, ui: 0, a11y: 0 },
      children: [],
    },
  };
}

function primitiveTemplate() {
  return {
    host: 'primitive.com',
    label: 'Primitive',
    tree: {
      id: 'n0', tag: 'Entry', label: 'Home', path: '/', status: 'queued' as const,
      defects: { ux: 1, ui: 2, a11y: 1 },
      children: [
        { id: 'n1', tag: 'Marketing', label: 'Products', path: '/products', status: 'queued' as const,
          defects: { ux: 1, ui: 0, a11y: 0 }, children: [] },
        { id: 'n2', tag: 'Pricing', label: 'Pricing', path: '/pricing', status: 'queued' as const,
          defects: { ux: 0, ui: 1, a11y: 1 }, children: [] },
        { id: 'n3', tag: 'Auth', label: 'Sign in', path: '/login', status: 'queued' as const,
          defects: { ux: 0, ui: 0, a11y: 0 }, children: [] },
      ],
    },
  };
}

function genericTemplate(host: string) {
  const label = host.split('.')[0]
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
  return {
    host,
    label,
    tree: {
      id: 'n0', tag: 'Entry', label: 'Home', path: '/', status: 'queued' as const,
      defects: { ux: 2, ui: 3, a11y: 4 },
      children: [
        { id: 'n1', tag: 'Marketing', label: 'Products', path: '/products', status: 'queued' as const,
          defects: { ux: 1, ui: 1, a11y: 2 },
          children: [
            { id: 'n4', tag: 'Tool', label: 'Features', path: '/products/features', status: 'queued' as const,
              defects: { ux: 0, ui: 1, a11y: 1 }, children: [] },
          ],
        },
        { id: 'n2', tag: 'Pricing', label: 'Pricing', path: '/pricing', status: 'queued' as const,
          defects: { ux: 1, ui: 2, a11y: 1 }, children: [] },
        { id: 'n3', tag: 'Auth', label: 'Sign in', path: '/login', status: 'queued' as const,
          defects: { ux: 0, ui: 0, a11y: 0 }, children: [] },
      ],
    },
  };
}

export function makeTreeForUrl(url: string) {
  const host = extractHost(url);
  const base =
    /elevenlabs/i.test(host) ? elevenLabsTemplate() :
    /nike/i.test(host)       ? nikeTemplate() :
    /amazon/i.test(host)     ? amazonTemplate() :
    /officedepot/i.test(host)? officeDepotTemplate() :
    /primitive/i.test(host)  ? primitiveTemplate() :
                               genericTemplate(host);

  const prefix = nextSessionPrefix();
  return {
    ...base,
    host: base.host || host,
    tree: withSessionIds(base.tree, prefix),
    sessionId: prefix.replace('_', ''),
  };
}

export function bfsOrder(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  const q: TreeNode[] = [root];
  while (q.length) {
    const n = q.shift()!;
    out.push(n);
    (n.children || []).forEach((c) => q.push(c));
  }
  return out;
}

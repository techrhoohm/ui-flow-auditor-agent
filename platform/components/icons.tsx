'use client';
import React from 'react';

interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'stroke'> {
  d?: string;
  w?: number;
  h?: number;
  stroke?: number;
  fill?: string;
}

const Icon = ({ d, w = 14, h = 14, stroke = 1.6, fill = 'none', children, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" width={w} height={h} fill={fill} stroke="currentColor"
       strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...props}>
    {d ? <path d={d} /> : children}
  </svg>
);

export const IcGlobe = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></Icon>;
export const IcLock  = (p: IconProps) => <Icon {...p}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></Icon>;
export const IcFolder = (p: IconProps) => <Icon {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>;
export const IcCaret = (p: IconProps) => <Icon {...p} d="M6 9l6 6 6-6"/>;
export const IcAgent = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></Icon>;
export const IcExport = (p: IconProps) => <Icon {...p} d="M12 4v12m0-12l-4 4m4-4l4 4M4 20h16"/>;
export const IcPlus = (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14"/>;
export const IcMinus = (p: IconProps) => <Icon {...p} d="M5 12h14"/>;
export const IcMaximize = (p: IconProps) => <Icon {...p} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>;
export const IcClose = (p: IconProps) => <Icon {...p} d="M6 6l12 12M18 6L6 18"/>;
export const IcSun = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></Icon>;
export const IcMoon = (p: IconProps) => <Icon {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>;
export const IcSearch = (p: IconProps) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Icon>;
export const IcChevronRight = (p: IconProps) => <Icon {...p} d="M9 6l6 6-6 6"/>;
export const IcPlay = (p: IconProps) => <Icon {...p} fill="currentColor" stroke={0} d="M8 5v14l11-7z"/>;
export const IcSpark = (p: IconProps) => <Icon {...p} d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>;
export const IcCamera = (p: IconProps) => <Icon {...p}><path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.5"/></Icon>;
export const IcLayers = (p: IconProps) => <Icon {...p} d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 18l9 5 9-5"/>;
export const IcTarget = (p: IconProps) => <Icon {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></Icon>;

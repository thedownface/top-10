import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20, sw = 2): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: sw, 'aria-hidden': true,
});

export const Arrow = ({ size, ...p }: P) => (
  <svg {...base(size, 2.25)} strokeLinecap="square" {...p}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);
export const Back = ({ size = 18, ...p }: P) => (
  <svg {...base(size, 2.25)} strokeLinecap="square" {...p}><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
);
export const Check = ({ size = 18, ...p }: P) => (
  <svg {...base(size, 3)} strokeLinecap="square" {...p}><path d="M20 6 9 17l-5-5" /></svg>
);
export const Close = ({ size = 22, ...p }: P) => (
  <svg {...base(size, 2.25)} strokeLinecap="square" {...p}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);
export const Lock = ({ size = 56, ...p }: P) => (
  <svg {...base(size, 1.75)} strokeLinecap="square" {...p}><rect width="18" height="11" x="3" y="11" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
export const Camera = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
);
export const Send = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} strokeLinejoin="miter" {...p}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
);
export const Heart = ({ size = 18, filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(size)} fill={filled ? '#EC3013' : 'none'} stroke={filled ? '#EC3013' : 'currentColor'} {...p}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);
export const Bubble = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
);
export const Bolt = ({ size = 18, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" /></svg>
);
export const Sun = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
);
export const Users = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
export const Columns = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z" /></svg>
);
export const ListNum = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} {...p}><path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" /></svg>
);
export const User = ({ size = 20, ...p }: P) => (
  <svg {...base(size)} strokeLinecap="square" {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
);

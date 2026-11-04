'use client';

import { useState, type CSSProperties } from 'react';
import { C, roman } from '@/lib/core';

/** One jigsaw edge from (x1,y1) to (x2,y2); k = +1 tab, -1 blank, 0 flat. */
function edge(x1: number, y1: number, x2: number, y2: number, k: number) {
  if (!k) return `L${x2},${y2}`;
  const dx = x2 - x1, dy = y2 - y1, r = Math.hypot(dx, dy) * 0.14;
  return `L${x1 + dx * 0.38},${y1 + dy * 0.38} A${r},${r} 0 1 ${k > 0 ? 1 : 0} ${x1 + dx * 0.62},${y1 + dy * 0.62} L${x2},${y2}`;
}
function piece(x: number, y: number, s: number, [t, r, b, l]: number[]) {
  return `M${x},${y} ${edge(x, y, x + s, y, t)} ${edge(x + s, y, x + s, y + s, r)} ${edge(x + s, y + s, x, y + s, b)} ${edge(x, y + s, x, y, l)} Z`;
}

/** The Figure: ten seats as ten interlocking pieces. `done` and `mine` are 0-based seat indexes. */
export function Board({ done, mine, assemble = false }: { done: number[]; mine: number; assemble?: boolean }) {
  const s = 60, o = 16;
  const H = [1, -1, 1, -1, 1];
  const V = [[1, -1, 1, -1], [-1, 1, -1, 1]];
  const items = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      const sides = [r === 0 ? 0 : -H[c], c === 4 ? 0 : V[r][c], r === 1 ? 0 : H[c], c === 0 ? 0 : -V[r][c - 1]];
      const on = done.includes(i), me = i === mine;
      const st: Record<string, string> = { transformBox: 'fill-box', transformOrigin: 'center' };
      if (assemble) {
        Object.assign(st, {
          '--dx': ((i * 47) % 140) - 70 + 'px',
          '--dy': ((i * 71) % 120) - 60 + 'px',
          '--rot': ((i * 53) % 90) - 45 + 'deg',
          animation: `assemble 1.1s cubic-bezier(.2,.8,.2,1) ${0.2 + i * 0.12}s both`,
        });
      }
      items.push({
        me,
        el: (
          <g key={i} style={st as CSSProperties}>
            <path
              d={piece(o + c * s, o + r * s, s, sides)}
              fill={on ? C.INK : C.P}
              stroke={me ? C.RED : C.INK}
              strokeWidth={me ? 3.5 : 2}
              strokeLinejoin="round"
              style={{ transition: 'fill .7s ease' }}
            />
            <text
              x={o + c * s + s / 2}
              y={o + r * s + s / 2 + 5}
              textAnchor="middle"
              fontSize={14}
              fontWeight={800}
              fontFamily="inherit"
              fill={on ? C.P : C.INK}
              style={{ transition: 'fill .7s ease' }}
            >
              {roman(i + 1)}
            </text>
          </g>
        ),
      });
    }
  }
  // Draw "my" piece last so its red outline sits on top.
  items.sort((a, b) => Number(a.me) - Number(b.me));
  return (
    <svg viewBox="0 0 332 152" role="img" aria-label={`${done.length} of 10 pieces in place`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
      {items.map((x) => x.el)}
    </svg>
  );
}

/** Welcome hero. Uses /hero.jpg when present; the floating pieces carry it on their own otherwise. */
export function Hero() {
  const [img, setImg] = useState(true);
  const pc = piece(0, 0, 100, [1, 1, -1, 1]);
  const pc2 = piece(0, 0, 100, [-1, 1, 1, -1]);
  const fl = (dur: number, delay: number): CSSProperties => ({
    animation: `floaty ${dur}s ease-in-out ${delay}s infinite`, transformBox: 'fill-box', transformOrigin: 'center',
  });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: C.G }}>
      {img && (
        <img
          src="/hero.jpg"
          alt=""
          onError={() => setImg(false)}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 18%',
            filter: 'grayscale(1) contrast(1.12)', mixBlendMode: 'multiply', animation: 'kenburns 18s ease-in-out infinite alternate',
          }}
        />
      )}
      <svg viewBox="0 0 390 480" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
        {!img && (
          <g transform="translate(118 150) scale(1.5)">
            <g style={fl(9, -3)}><path d={pc} fill={C.INK} stroke={C.P} strokeWidth={3} /></g>
          </g>
        )}
        <g transform="translate(36 26) scale(.4)"><g style={fl(6, 0)}><path d={pc} fill={C.P} stroke={C.INK} strokeWidth={5} /></g></g>
        <g transform="translate(176 40) scale(.24)"><g style={fl(7.5, -2)}><path d={pc2} fill={C.P} stroke={C.INK} strokeWidth={7} /></g></g>
        <g transform="translate(40 400) scale(.32)">
          <g style={fl(5.5, -1)}>
            <path d={pc2} fill={C.INK} stroke={C.P} strokeWidth={5} />
            <g style={{ animation: 'blink 5s ease-in-out infinite', transformBox: 'fill-box', transformOrigin: 'center' }}>
              <ellipse cx={50} cy={50} rx={30} ry={13} fill={C.P} />
              <circle cx={50} cy={50} r={9} fill={C.INK} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

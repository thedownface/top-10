import { ImageResponse } from 'next/og';

/** App mark: "10" in paper on ink, with the accent rule. Padded so it survives maskable cropping. */
export function iconResponse(size: number) {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#1E1B18', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: size * 0.2 }}>
        <div style={{ color: '#F4EAD6', fontSize: size * 0.46, fontWeight: 800, lineHeight: 1, letterSpacing: -size * 0.02 }}>10</div>
        <div style={{ width: size * 0.36, height: size * 0.05, background: '#EC3013', marginTop: size * 0.04 }} />
      </div>
    ),
    { width: size, height: size },
  );
}

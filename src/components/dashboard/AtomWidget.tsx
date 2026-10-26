import { useEffect, useRef } from 'react'

/**
 * Animated atom: nucleus pulses, three electron rings precess at
 * different speeds. Ring speed tracks typing energy (keys/sec), so it
 * spins up exactly when the operator is hammering the keyboard.
 */
export function AtomWidget({ energy }: { energy: number }) {
  const speedRef = useRef(1)
  useEffect(() => {
    speedRef.current = 1 + Math.min(16, energy * 1.8)
  }, [energy])

  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let t = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      t += speedRef.current * 0.016
      host.style.setProperty('--a1', `${t * 57}deg`)
      host.style.setProperty('--a2', `${-t * 41 + 60}deg`)
      host.style.setProperty('--a3', `${-t * 29 + 120}deg`)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const orbit = {
    cx: 32,
    cy: 32,
    rx: 26,
    ry: 10,
    fill: 'none' as const,
    stroke: '#1FA34A',
    strokeWidth: 1.4,
  }

  return (
    <div
      ref={hostRef}
      className="relative grid h-full place-items-center overflow-hidden py-1"
      style={{ '--a1': '20deg', '--a2': '60deg', '--a3': '120deg' } as React.CSSProperties}
    >
      <svg viewBox="0 0 64 64" className="h-full max-h-24 w-auto" style={{ filter: 'drop-shadow(0 0 5px #39ff6f55)' }}>
        <ellipse {...orbit} style={orbitStyle('--a1')} />
        <ellipse {...orbit} style={orbitStyle('--a2')} />
        <ellipse {...orbit} style={orbitStyle('--a3')} />

        {/* three electrons, squashed onto their orbit ellipses */}
        <Electron var="--a1" />
        <Electron var="--a2" />
        <Electron var="--a3" />

        {/* nucleus with pulse halo */}
        <circle cx="32" cy="32" r="7" fill="rgba(57,255,111,0.25)" className="atom-nucleus-halo" />
        <circle cx="32" cy="32" r="3.6" fill="#39FF6F" />
      </svg>
    </div>
  )
}

function orbitStyle(varName: string): React.CSSProperties {
  return {
    transform: `rotate(var(${varName}, 0deg))`,
  }
}

function Electron({ var: varName }: { var: string }) {
  return (
    <g
      style={{ transform: 'scale(1, 0.3846)', transformBox: 'view-box', transformOrigin: '32px 32px' }}
    >
      <g
        style={{
          transform: `rotate(var(${varName}, 0deg))`,
          transformBox: 'view-box',
          transformOrigin: '32px 32px',
        }}
      >
        <circle cx="58" cy="32" r="2.3" fill="#39FF6F" />
      </g>
    </g>
  )
}

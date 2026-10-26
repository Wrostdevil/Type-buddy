import type { KeyFeedback } from './engine'

/**
 * Mechanical-switch sounds, synthesized live with the Web Audio API —
 * no audio files. Each keystroke stacks the four physical layers of a
 * real linear/tactile switch:
 *
 *   1. click   — the sharp high tactility transient (~5–7 kHz)
 *   2. clack   — keycap/plastic bottom-out noise (~1.5–2.6 kHz)
 *   3. thock   — case/body resonance (~100–250 Hz pitch-dropping thud)
 *   4. upstroke— quieter spring-return tick ~60 ms after the hit
 *
 * Random pitch/loudness/pan jitter per keystroke mimics a real board,
 * and a master compressor glues rapid typing together without clipping.
 *
 * The shared AudioContext is created lazily on the first keystroke (a
 * user gesture), so browser autoplay policies never block playback.
 */

let enabled = true
let context: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null

export function setSoundEnabled(value: boolean): void {
  enabled = value
}

function ensureContext(): AudioContext | null {
  try {
    if (context === null) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!Ctor) return null
      context = new Ctor()
      // master chain: voice bus → compressor → output. The compressor
      // keeps stacked keystrokes during fast bursts clean and "in the case".
      const comp = context.createDynamicsCompressor()
      comp.threshold.value = -20
      comp.knee.value = 18
      comp.ratio.value = 5
      comp.attack.value = 0.002
      comp.release.value = 0.12
      master = context.createGain()
      master.gain.value = 0.5
      master.connect(comp)
      comp.connect(context.destination)
      // 120ms of white noise, reused by every click/clack burst
      const frames = Math.floor(context.sampleRate * 0.12)
      noise = context.createBuffer(1, frames, context.sampleRate)
      const data = noise.getChannelData(0)
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1
    }
    if (context.state === 'suspended') void context.resume()
    return context
  } catch {
    return null
  }
}

interface Layer {
  freq: number
  q: number
  gain: number
  /** seconds until inaudible */
  decay: number
  /** stereo position, -1..1 (per-key pan variance) */
  pan?: number
}

/** Filtered noise transient — the click/clack part of the strike. */
function noiseHit(ctx: AudioContext, when: number, opts: Layer): void {
  if (!noise || !master) return
  const source = ctx.createBufferSource()
  source.buffer = noise
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = opts.freq
  filter.Q.value = opts.q
  const env = ctx.createGain()
  env.gain.setValueAtTime(Math.max(0.0001, opts.gain), when)
  env.gain.exponentialRampToValueAtTime(0.0001, when + opts.decay)
  const panner = ctx.createStereoPanner()
  panner.pan.value = opts.pan ?? 0
  source.connect(filter).connect(env).connect(panner).connect(master)
  source.start(when)
  source.stop(when + opts.decay + 0.01)
}

/** Pitch-dropping tone — the case/body "thock" of the strike. */
function toneHit(
  ctx: AudioContext,
  when: number,
  opts: { freq: number; gain: number; decay: number; pan?: number },
): void {
  if (!master) return
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(opts.freq, when)
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(40, opts.freq * 0.55),
    when + opts.decay,
  )
  const env = ctx.createGain()
  env.gain.setValueAtTime(Math.max(0.0001, opts.gain), when)
  env.gain.exponentialRampToValueAtTime(0.0001, when + opts.decay)
  const panner = ctx.createStereoPanner()
  panner.pan.value = opts.pan ?? 0
  osc.connect(env).connect(panner).connect(master)
  osc.start(when)
  osc.stop(when + opts.decay + 0.01)
}

/** Small metallic ring for a correctly committed word. */
function bell(ctx: AudioContext, when: number, freq: number): void {
  if (!master) return
  const partials: Array<readonly [number, number, number]> = [
    [1, 0.035, 0.32],
    [2.42, 0.018, 0.24],
  ]
  for (const [ratio, gain, decay] of partials) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, when)
    env.gain.exponentialRampToValueAtTime(0.0001, when + decay)
    osc.connect(env).connect(master)
    osc.start(when)
    osc.stop(when + decay + 0.02)
  }
}

interface SwitchProfile {
  /** the tactile transient right at actuation */
  click: Layer
  /** the bottom-out clack as the stem slams the housing */
  clack: Layer
  /** body resonance under the strike */
  thock: { freq: number; gain: number; decay: number }
  /** spring-return tick: [delay, gain-scale] after the hit */
  upstroke: readonly [number, number]
}

/**
 * Per-event switch tuning. Character hits are the reference "blue" key:
 * crisp tactility, bright clack, medium body. Space is a wide, deep
 * stabilizer thud. Backspace is a duller, heavier return key.
 */
const PROFILE: Record<'char' | 'dud' | 'space' | 'backspace', SwitchProfile> = {
  char: {
    click: { freq: 5400, q: 9, gain: 0.17, decay: 0.012 },
    clack: { freq: 2250, q: 2.1, gain: 0.24, decay: 0.03 },
    thock: { freq: 195, gain: 0.24, decay: 0.045 },
    upstroke: [0.058, 0.4],
  },
  dud: {
    click: { freq: 3100, q: 6, gain: 0.09, decay: 0.01 },
    clack: { freq: 1150, q: 2.6, gain: 0.15, decay: 0.04 },
    thock: { freq: 125, gain: 0.22, decay: 0.06 },
    upstroke: [0.07, 0.25],
  },
  space: {
    click: { freq: 3800, q: 7, gain: 0.13, decay: 0.014 },
    clack: { freq: 1450, q: 1.8, gain: 0.3, decay: 0.05 },
    thock: { freq: 108, gain: 0.32, decay: 0.08 },
    upstroke: [0.065, 0.5],
  },
  backspace: {
    click: { freq: 4900, q: 10, gain: 0.11, decay: 0.01 },
    clack: { freq: 1350, q: 2.4, gain: 0.17, decay: 0.038 },
    thock: { freq: 155, gain: 0.22, decay: 0.055 },
    upstroke: [0.07, 0.3],
  },
}

/**
 * Plays the sound matching a keystroke classification from the engine.
 * Safe to call anywhere: it is a no-op when muted, before any user gesture,
 * or where the Web Audio API is unavailable.
 */
export function playKeySound(feedback: KeyFeedback): void {
  if (!enabled || feedback.kind === 'none') return
  const ctx = ensureContext()
  if (!ctx) return

  // tiny jitter so keys landing in the same millisecond don't stack perfectly
  const when = ctx.currentTime + Math.random() * 0.004
  // ±15% loudness/pitch unevenness, like a real mechanism
  const level = 0.85 + Math.random() * 0.3
  // each key physically sits elsewhere on the board → slight pan drift
  const pan = (Math.random() - 0.5) * 0.55

  let profile: SwitchProfile
  if (feedback.kind === 'backspace') profile = PROFILE.backspace
  else if (feedback.kind === 'space') profile = PROFILE.space
  else profile = feedback.correct ? PROFILE.char : PROFILE.dud

  const pitch = 0.92 + Math.random() * 0.16 // per-key pitch drift
  const { click, clack, thock, upstroke } = profile

  noiseHit(ctx, when, {
    ...click,
    freq: click.freq * pitch,
    gain: click.gain * level,
    pan,
  })
  noiseHit(ctx, when + 0.002, {
    ...clack,
    freq: clack.freq * pitch,
    gain: clack.gain * level,
    pan,
  })
  toneHit(ctx, when, {
    freq: thock.freq * pitch,
    gain: thock.gain * level,
    decay: thock.decay,
    pan,
  })

  // spring-return tick on the upstroke, quieter and higher
  const [delay, scale] = upstroke
  noiseHit(ctx, when + delay, {
    freq: (click.freq * 1.25 * pitch) | 0,
    q: 10,
    gain: click.gain * scale * level,
    decay: 0.01,
    pan,
  })

  // classic carriage bell when the word was typed correctly
  if (feedback.kind === 'space' && feedback.correct) {
    bell(ctx, when + 0.02, 1731)
  }
}

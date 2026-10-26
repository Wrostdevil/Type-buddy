import { Play, Repeat } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { resultLabel } from '../lib/engine'
import type { TestResult } from '../lib/engine'

const tooltipStyle = {
  background: '#04140B',
  border: '1px solid #12402A',
  borderRadius: 6,
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '6px 10px',
}
const labelStyle = { color: '#5FA97C', marginBottom: 4 }
const itemStyle = { color: '#CFFFE0' }

interface ResultsProps {
  result: TestResult
  onNext: () => void
  onRepeat: () => void
}

export function Results({ result, onNext, onRepeat }: ResultsProps) {
  const data = result.series.map((s) => ({
    t: s.t,
    wpm: Math.round(s.wpm),
    raw: s.raw,
    errors: s.errors,
  }))

  return (
    <div className="animate-slide-up">
      <div className="flex flex-col gap-5 md:flex-row md:items-center sm:gap-6">
        <div className="flex shrink-0 gap-6 sm:gap-8">
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-terminal-text-dim">
              wpm
            </div>
            <div className="font-mono text-4xl font-bold tabular-nums text-terminal-accent sm:text-5xl">
              {Math.round(result.wpm)}
            </div>
          </div>
          <div>
            <div className="font-mono text-xs uppercase tracking-wider text-terminal-text-dim">
              accuracy
            </div>
            <div className="font-mono text-4xl font-bold tabular-nums text-terminal-text sm:text-5xl">
              {result.accuracy}
              <span className="text-xl text-terminal-text-dim sm:text-2xl">%</span>
            </div>
          </div>
        </div>

        <div className="h-44 min-w-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="#12402A" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                tick={{ fill: '#5FA97C', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(v: number) => `${v}s`}
                stroke="#12402A"
              />
              <YAxis
                width={34}
                tick={{ fill: '#5FA97C', fontSize: 10, fontFamily: 'monospace' }}
                stroke="#12402A"
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={labelStyle}
                itemStyle={itemStyle}
                cursor={{ stroke: '#12402A' }}
              />
              <Line
                type="monotone"
                dataKey="wpm"
                name="wpm"
                stroke="#39FF6F"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="raw"
                name="raw"
                stroke="#1FA34A"
                strokeWidth={1}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                dataKey="errors"
                name="errors"
                stroke="transparent"
                dot={{ r: 2.5, fill: '#FF5252', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-terminal-border pt-4">
        <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-terminal-text-dim">
          <span>
            test <span className="text-terminal-text">{resultLabel(result)}</span>
          </span>
          <span>
            raw <span className="tabular-nums text-terminal-text">{Math.round(result.raw)}</span>
          </span>
          <span>
            consistency{' '}
            <span className="tabular-nums text-terminal-text">{result.consistency}%</span>
          </span>
          <span>
            chars{' '}
            <span className="tabular-nums text-terminal-text">
              {result.chars.correct}/{result.chars.incorrect}/{result.chars.missed}
            </span>
          </span>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm" onClick={onRepeat}>
            <Repeat size={14} className="mr-1.5 inline" />
            repeat
          </button>
          <button type="button" className="btn-primary text-sm" onClick={onNext}>
            <Play size={14} className="mr-1.5 inline" />
            next test
          </button>
        </div>
      </div>
    </div>
  )
}

import { Activity, Ghost, History as HistoryIcon, Trash2, Trophy } from 'lucide-react'
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

interface HistoryViewProps {
  history: TestResult[]
  onClear: () => void
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy
  label: string
  value: string
}) {
  return (
    <div className="panel flex items-center gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-terminal-border bg-terminal-bg">
        <Icon size={16} className="text-terminal-accent" />
      </span>
      <div className="leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-wider text-terminal-text-dim">
          {label}
        </div>
        <div className="font-mono text-lg font-semibold tabular-nums text-terminal-text">
          {value}
        </div>
      </div>
    </div>
  )
}

export function HistoryView({ history, onClear }: HistoryViewProps) {
  const best = history.reduce((max, r) => Math.max(max, r.wpm), 0)
  const last10 = history.slice(0, 10)
  const avg10 = last10.length
    ? Math.round((last10.reduce((sum, r) => sum + r.wpm, 0) / last10.length) * 10) / 10
    : 0
  const trend = history
    .slice(0, 30)
    .slice()
    .reverse()
    .map((r, i) => ({ i: i + 1, wpm: Math.round(r.wpm), acc: Math.round(r.accuracy) }))

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-mono text-sm text-terminal-text-dim">
          <HistoryIcon size={15} className="text-terminal-accent" />
          session history
        </h2>
        <button
          type="button"
          className="btn-danger flex items-center gap-1.5 text-xs"
          onClick={onClear}
          disabled={history.length === 0}
        >
          <Trash2 size={13} />
          clear history
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Trophy} label="best wpm" value={best > 0 ? String(Math.round(best)) : '—'} />
        <StatCard
          icon={Activity}
          label="avg wpm (last 10)"
          value={last10.length > 0 ? String(avg10) : '—'}
        />
        <StatCard icon={Ghost} label="tests completed" value={String(history.length)} />
      </div>

      {history.length > 0 && (
        <div className="panel h-52 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 8, right: 6, bottom: 0, left: -22 }}>
              <CartesianGrid stroke="#12402A" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="i"
                tick={{ fill: '#5FA97C', fontSize: 10, fontFamily: 'monospace' }}
                tickFormatter={(v: number) => `#${v}`}
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
                dot={{ r: 2.5, fill: '#39FF6F', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="panel overflow-hidden">
        {history.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Ghost size={28} className="text-terminal-text-dim" />
            <p className="font-mono text-sm text-terminal-text-dim">
              no results yet — finish a test and it will be saved here
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-sm">
              <thead>
                <tr className="border-b border-terminal-border text-left text-xs uppercase tracking-wider text-terminal-text-dim">
                  <th className="px-4 py-2.5 font-normal">date</th>
                  <th className="px-4 py-2.5 font-normal">test</th>
                  <th className="px-4 py-2.5 text-right font-normal">wpm</th>
                  <th className="px-4 py-2.5 text-right font-normal">acc</th>
                  <th className="hidden px-4 py-2.5 text-right font-normal sm:table-cell">
                    raw
                  </th>
                  <th className="hidden px-4 py-2.5 text-right font-normal sm:table-cell">
                    consistency
                  </th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 50).map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-terminal-border/50 text-terminal-text last:border-0 hover:bg-terminal-panel/60"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-terminal-text-dim">
                      {new Date(r.date).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs">
                      {resultLabel(r)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-terminal-accent">
                      {Math.round(r.wpm)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.accuracy}%</td>
                    <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                      {Math.round(r.raw)}
                    </td>
                    <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">
                      {r.consistency}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

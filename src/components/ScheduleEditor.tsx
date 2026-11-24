import { DAYS, describeSchedule, ordinal, previewDates, type ScheduleForm } from '../lib/schedule'
import { cx } from './cx'
import { Icon } from './Icon'
import { NumberStepper } from './NumberStepper'
import { SegmentedControl } from './SegmentedControl'
import { SelectField } from './SelectField'

/** How often a chore comes round, in words a non-technical flatmate would use. */
export function ScheduleEditor({ value, onChange, today }: { value: ScheduleForm; onChange: (v: ScheduleForm) => void; today: string }) {
  const set = (patch: Partial<ScheduleForm>) => onChange({ ...value, ...patch })
  const next = previewDates(value, today)
  const unitLabel = (u: string) => (value.every === 1 ? u.replace(/s$/, '') : u)

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[14px] leading-5 font-semibold">How often does this need doing?</p>
      <SegmentedControl
        label="How often"
        value={value.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'once', label: 'Once' },
          { value: 'after', label: 'After it’s done' },
          { value: 'calendar', label: 'On set days' },
        ]}
      />
      {value.mode === 'after' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] leading-5 font-semibold">How long after it’s done?</span>
          <div role="group" aria-label="How long after it’s done" className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body">
            <NumberStepper value={value.every} min={1} max={30} label={`Number of ${value.unit}`} onChange={(every) => set({ every })} />
            <SelectField
              ariaLabel="Unit"
              className="w-32"
              value={value.unit}
              onChange={(unit) => set({ unit: unit as ScheduleForm['unit'] })}
              options={['days', 'weeks', 'months'].map((u) => ({ value: u, label: unitLabel(u) }))}
            />
            <span>after it’s done</span>
          </div>
          <p className="m-0 text-[13px] leading-[18px] text-fg-muted">Good for things that get dirty with use, like the bathroom. If it’s done late, the next one moves too.</p>
        </div>
      )}
      {value.mode === 'calendar' && (
        <div className="flex flex-col gap-3">
          <SegmentedControl
            label="Repeat on"
            value={value.calMode}
            onChange={(calMode) => set({ calMode })}
            options={[
              { value: 'week', label: 'Days of the week' },
              { value: 'month', label: 'Day of the month' },
            ]}
          />
          {value.calMode === 'week' ? (
            <div role="group" aria-label="Days" className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d) => {
                const on = value.days.includes(d.key)
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.name}
                    onClick={() => set({ days: on ? value.days.filter((x) => x !== d.key) : [...value.days, d.key] })}
                    className={cx(
                      'min-h-(--size-touch) cursor-pointer rounded-full border text-[14px] font-semibold',
                      on ? 'border-primary bg-primary text-on-primary' : 'border-border-strong bg-surface text-fg hover:bg-surface-hover',
                    )}
                  >
                    {d.short}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body">
              <span>On the</span>
              <NumberStepper value={value.dom} min={1} max={31} label="Day of the month" onChange={(dom) => set({ dom })} />
              <span>{ordinal(value.dom).replace(/^\d+/, '')} day of each month</span>
            </div>
          )}
          <p className="m-0 text-[13px] leading-[18px] text-fg-muted">Good for fixed days, like bins on collection day.</p>
        </div>
      )}
      <div role="status" className="flex items-start gap-3 rounded-md bg-surface-sunken px-4 py-3 text-[15px] leading-[22px]">
        <Icon name={value.mode === 'once' ? 'circle-dot' : 'repeat-2'} className="mt-px shrink-0 text-primary" />
        <span>
          <strong className="font-semibold">{describeSchedule(value)}</strong>
          {next.length > 0 && (
            <span className="mt-0.5 block text-[13px] leading-[18px] text-fg-muted">
              {value.mode === 'after' ? 'If done today: ' : 'Next: '}
              {next.join(' · ')}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

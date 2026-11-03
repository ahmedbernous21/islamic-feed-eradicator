import { SNOOZE_PRESETS } from '../shared/settings';

export function SnoozePicker({
  minutes,
  snoozing,
  onSnooze,
  onResume,
}: {
  minutes: number;
  snoozing: boolean;
  onSnooze: (minutes: number) => void;
  onResume: () => void;
}) {
  return (
    <div className="theme-picks" role="group" aria-label="Snooze">
      {SNOOZE_PRESETS.map((preset) => (
        <button
          key={preset.minutes}
          type="button"
          aria-pressed={snoozing && minutes === preset.minutes}
          onClick={() => onSnooze(preset.minutes)}
        >
          {preset.label}
        </button>
      ))}
      {snoozing ? (
        <button type="button" onClick={onResume}>
          Cancel snooze
        </button>
      ) : null}
    </div>
  );
}

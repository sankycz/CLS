import { useState, type ReactNode } from 'react';
import { haptic } from '../hooks/haptic';

type Tone = 'default' | 'danger' | 'warn' | 'ok' | 'accent' | 'ghost';

export const Button = ({
  children,
  onClick,
  tone = 'default',
  big = false,
  disabled = false,
  pressed,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: Tone;
  big?: boolean;
  disabled?: boolean;
  pressed?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    className={`btn btn-${tone}${big ? ' btn-big' : ''} ${className}`}
    disabled={disabled}
    aria-pressed={pressed}
    onClick={() => {
      haptic();
      onClick();
    }}
  >
    {children}
  </button>
);

export type ChoiceOption<T extends string> = { value: T; label: string; tone?: Tone; hint?: string };

export const Choice = <T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 1,
}: {
  label?: string;
  options: ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  columns?: number;
}) => (
  <fieldset className="choice">
    {label && <legend>{label}</legend>}
    <div className="choice-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`btn btn-${option.tone ?? 'default'} choice-option`}
          aria-pressed={value === option.value}
          onClick={() => {
            haptic();
            onChange(option.value);
          }}
        >
          <span>{option.label}</span>
          {option.hint && <small>{option.hint}</small>}
        </button>
      ))}
    </div>
  </fieldset>
);

export const Stepper = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) => {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="btn stepper-btn" aria-label={`${label} méně`} onClick={() => { haptic(); onChange(clamp((value ?? min) - step)); }}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value ?? ''}
          placeholder="—"
          min={min}
          max={max}
          aria-label={label}
          onChange={(event) => onChange(event.target.value === '' ? undefined : clamp(Number(event.target.value)))}
        />
        <button type="button" className="btn stepper-btn" aria-label={`${label} více`} onClick={() => { haptic(); onChange(clamp((value ?? min) + step)); }}>
          +
        </button>
      </div>
      {unit && <span className="stepper-unit">{unit}</span>}
    </div>
  );
};

export const Section = ({ title, children, tone }: { title?: string; children: ReactNode; tone?: 'warn' | 'danger' }) => (
  <section className={`section${tone ? ` section-${tone}` : ''}`}>
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

export const Guidance = ({ items }: { items: string[] }) => (
  <ul className="guidance">
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </ul>
);

export const CopyButton = ({ text, label = 'Kopírovat' }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      tone="accent"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
    >
      {copied ? 'Zkopírováno ✓' : label}
    </Button>
  );
};

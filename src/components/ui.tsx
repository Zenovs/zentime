import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: number;
  muted?: boolean;
}

/** Icon-Schaltfläche, 20 px Lucide-Icon mit Strichstärke 1.5, Trefffläche 32 px */
export function IconButton({ icon: Icon, label, size = 20, muted = true, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        // Keine gefüllte Fläche beim Überfahren: zentime zeigt an, das Icon
        // wechselt dafür die Farbe.
        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
        muted ? 'text-muted hover:text-fg' : 'text-fg',
        className,
      )}
      {...rest}
    >
      <Icon size={size} strokeWidth={1.5} aria-hidden />
    </button>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-6 w-10 flex-none rounded-full transition-colors',
        checked ? 'bg-fg' : 'bg-line',
        disabled && 'opacity-40',
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 h-5 w-5 rounded-full transition-[left]',
          checked ? 'left-[18px] bg-bg' : 'left-0.5 bg-bg dark-knob',
        )}
      />
    </button>
  );
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
  className?: string;
}

export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('grid h-8 gap-0.5 rounded-[10px] bg-line p-0.5', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            'truncate rounded-lg px-2 text-[13px] leading-4 font-semibold transition-colors',
            o.value === value ? 'bg-bg text-fg' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}

export function Field({ label, value, onChange, hint, className, ...rest }: FieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[13px] leading-4 text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        className={cx(
          'h-11 rounded-xl border border-line bg-transparent px-3 text-[15px] leading-5 text-fg outline-none placeholder:text-muted focus:border-muted',
          className,
        )}
        {...rest}
      />
      {hint ? <span className="text-[13px] leading-[18px] text-muted">{hint}</span> : null}
    </label>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  busy?: boolean;
  children: ReactNode;
}

export function Button({ variant = 'primary', busy, children, className, disabled, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx(
        'flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[15px] leading-5 font-semibold transition-opacity',
        variant === 'primary' && 'bg-fg text-bg',
        variant === 'secondary' && 'border border-line text-fg hover:bg-line',
        variant === 'danger' && 'border border-line text-fg hover:bg-line',
        (disabled || busy) && 'opacity-50',
        className,
      )}
      {...rest}
    >
      {busy ? <Loader2 size={18} strokeWidth={1.5} className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[13px] leading-4 text-muted">{children}</div>;
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span aria-hidden className="inline-block flex-none rounded-full" style={{ width: size, height: size, background: color }} />;
}

/** Kopfzeile einer Unteransicht mit Zurück-Pfeil oder Schliessen */
export function ViewHeader({ title, left, right }: { title: string; left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {left}
        <h1 className="truncate text-[20px] leading-6 font-semibold">
          {title}
        </h1>
      </div>
      {right}
    </header>
  );
}

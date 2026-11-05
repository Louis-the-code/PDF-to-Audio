import { Eye, EyeOff, Lock } from 'lucide-react';
import { useState, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { id: string };

/** Password field with a show/hide toggle, so people can check what they typed. */
export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-faint" />
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={
          className ??
          'h-12 w-full rounded-xl border border-white/[0.08] bg-ink-800 pl-11 pr-12 text-[15px] text-mist placeholder:text-mist-faint outline-none transition-[border-color,box-shadow] duration-150 focus:border-signal/60 focus:shadow-[0_0_0_4px_rgb(255_138_92/0.12)]'
        }
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="press absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-mist-faint hover:bg-white/[0.06] hover:text-mist"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

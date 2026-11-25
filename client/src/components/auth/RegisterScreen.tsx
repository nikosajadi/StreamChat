// ===========================================================================
// RegisterScreen: the first thing you see. A centered "paper card" with the
// app name, a name field and a Join button.
// ---------------------------------------------------------------------------
// Calls the server's `register` hub method through useChat().register,
// which also sends/saves the per-name token. Validation here is only for
// quick feedback; the server checks everything again.
// ===========================================================================
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { loadToken, normalizeName } from '../../lib/socket';
import { toast } from '../../lib/toast';
import type { ConnectionState } from '../../hooks/useConnection';
import { ChatBackground } from '../ui/ChatBackground';

interface Props {
  onRegister: (name: string) => Promise<string | null>;
  connection: ConnectionState;
}

// Last name used in this tab, to prefill the field.
function lastName(): string {
  try {
    return sessionStorage.getItem('streamchat:name') ?? '';
  } catch {
    return '';
  }
}

export function RegisterScreen({ onRegister, connection }: Props) {
  const [name, setName] = useState(lastName);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const clean = normalizeName(name);
  const tooLong = name.trim().length > 24;

  // After a page reload: if this tab was logged in (name in sessionStorage)
  // and we have that name's token, log back in without asking. Runs once,
  // as soon as the socket is connected.
  const triedAuto = useRef(false);
  useEffect(() => {
    if (triedAuto.current || connection !== 'connected') return;
    triedAuto.current = true;
    const saved = lastName();
    if (saved && loadToken(saved)) void join(saved);
  }, [connection]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!clean) return setError('Pick a name first.');
    if (connection !== 'connected') return setError("Can't reach the server yet. Give it a second.");
    await join(clean);
  }

  // Shared by the form and the automatic re-login.
  async function join(who: string) {
    setBusy(true);
    const err = await onRegister(who);
    setBusy(false);
    if (err) {
      setError(err); // inline, next to the field
      toast(err); // and as a toast, like every other ack error
      return;
    }
    try {
      sessionStorage.setItem('streamchat:name', who);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="relative grid min-h-full place-items-center overflow-hidden px-5 py-16">
      <ChatBackground />

      <motion.form
        onSubmit={submit}
        noValidate
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
        className="relative w-full max-w-[400px] rounded-card border border-hair bg-paper/90 px-8 pb-8 pt-9 shadow-card backdrop-blur-sm sm:px-10"
        aria-labelledby="register-title"
      >
        <p className="label">Issue No. 1 · A small messenger</p>
        <h1 id="register-title" className="mt-3 font-display text-[44px] font-medium leading-none tracking-tight text-ink">
          Stream<span className="italic text-accent">chat</span>
        </h1>
        <hr className="rule my-6" />

        <label htmlFor="name" className="label block">
          Your name
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError('');
          }}
          autoComplete="off"
          autoFocus
          maxLength={40}
          placeholder="Ada Lovelace"
          aria-invalid={!!error}
          aria-describedby="name-help"
          className="mt-2 w-full border-0 border-b border-hair bg-transparent px-0 py-2 font-display text-2xl text-ink placeholder:text-ink-muted/60 focus:border-accent focus:outline-none focus:ring-0"
        />
        <p id="name-help" className={`mt-2 min-h-[1.25rem] text-sm ${error ? 'text-danger' : 'text-ink-muted'}`} role={error ? 'alert' : undefined}>
          {error || (tooLong ? 'Only the first 24 characters will be used.' : 'This is how others will see you.')}
        </p>

        <button
          type="submit"
          disabled={busy}
          className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-paper transition-transform hover:-translate-y-px active:translate-y-0 disabled:opacity-60"
        >
          {busy ? 'Joining…' : 'Join the conversation'}
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>

        <p className="mt-5 text-center text-xs text-ink-muted">
          Coming back? Use the same name in this browser and your messages will be waiting.
        </p>
      </motion.form>
    </main>
  );
}

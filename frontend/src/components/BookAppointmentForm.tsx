'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Badge, StatusDot } from '@/components/ui';
import { IconCalendar, IconCheck, IconClock, IconStethoscope } from '@/components/icons';

type Doctor = { id: string; name: string | null; specialization: string | null; facility?: { name: string } | null };

const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '16:00', '16:30'];

function buildSlots(date: string) {
  if (!date) return [];
  return SLOTS.map((t) => `${date}T${t}:00.000Z`);
}

export default function BookAppointmentForm({ preselectDoctor }: { preselectDoctor?: string }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState(preselectDoctor ?? '');
  const [date, setDate] = useState('');
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    apiGet<Doctor[]>('/doctors').then((r) => { if (r.ok) setDoctors(r.data); }).catch(() => undefined);
  }, []);

  const selected = useMemo(() => doctors.find((d) => d.id === doctorId), [doctors, doctorId]);
  const today = new Date().toISOString().slice(0, 10);
  const slots = buildSlots(date);

  async function confirm() {
    if (!doctorId || !date || !slot) {
      setError('Choose a doctor, a date and a time slot.');
      return;
    }
    setError(null);
    setPending(true);
    const res = await apiPost<{ id: string; status: string }>('/appointments', {
      doctorId,
      startsAt: slot,
      notes: notes || undefined,
    });
    setPending(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setSuccess(`Appointment ${res.data.status.toLowerCase()} — reference ${res.data.id.slice(0, 8)}`);
    setStage(4);
  }

  const steps = ['Doctor', 'Date', 'Time', 'Confirmed'];

  return (
    <div className="rounded-3xl bg-white p-6 shadow-soft ring-1 ring-slate-200/70 sm:p-8">
      {/* stepper */}
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {steps.map((s, i) => {
          const n = i + 1;
          const done = stage > n;
          const active = stage === n;
          return (
            <li key={s} className="flex items-center gap-2">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors ${
                  done ? 'bg-success text-white' : active ? 'bg-brand-600 text-white' : 'bg-slate-200 text-ink-subtle'
                }`}
              >
                {done ? <IconCheck size={14} /> : n}
              </span>
              <span className={`text-[13px] ${active ? 'font-bold text-ink' : 'text-ink-muted'}`}>{s}</span>
              {n < steps.length && <span className="mx-1 hidden h-px w-8 bg-slate-200 sm:block" />}
            </li>
          );
        })}
      </ol>

      {/* stage 1 doctor */}
      {stage === 1 && (
        <div className="mt-7">
          <h2 className="text-base font-bold text-ink">Choose a doctor</h2>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {doctors.length === 0 && (
              <p className="text-sm text-ink-muted">No doctors are registered yet. Check back soon.</p>
            )}
            {doctors.map((d) => {
              const active = doctorId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDoctorId(d.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                    active ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
                    <IconStethoscope size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{d.name ?? 'Doctor'}</span>
                    <span className="block truncate text-[13px] text-ink-muted">
                      {d.specialization ?? 'General'}
                      {d.facility?.name ? ` · ${d.facility.name}` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <NextButton disabled={!doctorId} onClick={() => setStage(2)}>
            Continue
          </NextButton>
        </div>
      )}

      {/* stage 2 date */}
      {stage === 2 && (
        <div className="mt-7">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <IconCalendar size={18} className="text-brand-600" />
            Pick a date
          </h2>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => {
              setDate(e.target.value);
              setSlot('');
            }}
            className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />
          <p className="mt-3 text-[13px] text-ink-muted">
            {selected ? `Booking with ${selected.name ?? 'doctor'}` : 'Select a doctor first'}
          </p>
          <BackNext onBack={() => setStage(1)} onNext={() => setStage(3)} nextDisabled={!date} />
        </div>
      )}

      {/* stage 3 slot */}
      {stage === 3 && (
        <div className="mt-7">
          <h2 className="flex items-center gap-2 text-base font-bold text-ink">
            <IconClock size={18} className="text-brand-600" />
            Choose a time
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s}
                onClick={() => setSlot(s)}
                aria-pressed={slot === s}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
                  slot === s
                    ? 'bg-brand-600 text-white shadow-[0_10px_22px_-12px_rgba(31,69,245,0.9)]'
                    : 'bg-slate-100 text-ink-muted hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {s.slice(11, 16)} UTC
              </button>
            ))}
          </div>

          <label htmlFor="notes" className="mt-5 block text-sm font-semibold text-ink">
            Anything the doctor should know? (optional)
          </label>
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10"
          />

          {error && (
            <p role="alert" className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger ring-1 ring-danger/20">
              {error}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStage(2)} className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-100">
              Back
            </button>
            <button
              onClick={confirm}
              disabled={pending || !slot}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? 'Confirming…' : 'Confirm appointment'}
            </button>
          </div>
        </div>
      )}

      {/* stage 4 success */}
      {stage === 4 && (
        <div className="mt-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-success/10 text-success">
            <IconCheck size={30} />
          </span>
          <h2 className="mt-4 text-lg font-bold text-ink">Appointment requested</h2>
          <p className="mt-1 text-sm text-ink-muted">{success}</p>
          <div className="mt-5 flex justify-center">
            <Badge tone="success">
              <StatusDot tone="success" />
              Track it from your dashboard
            </Badge>
          </div>
          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Go to dashboard
          </a>
        </div>
      )}
    </div>
  );
}

function NextButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="mt-6 rounded-full bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function BackNext({
  onBack,
  onNext,
  nextDisabled,
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="mt-6 flex gap-3">
      <button onClick={onBack} className="rounded-full px-5 py-2.5 text-sm font-semibold text-ink-muted hover:bg-slate-100">
        Back
      </button>
      <NextButton disabled={nextDisabled} onClick={onNext}>
        Continue
      </NextButton>
    </div>
  );
}
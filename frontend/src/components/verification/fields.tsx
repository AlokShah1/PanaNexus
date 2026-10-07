export type FieldOption = { value: string; label: string };

export type FieldDef = {
  name: string;
  label: string;
  control?: 'input' | 'textarea' | 'select';
  type?: 'text' | 'tel' | 'email';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  options?: FieldOption[];
  rows?: number;
};

export const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink shadow-sm transition-all placeholder:text-ink-subtle focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10 outline-none';

const FACILITY_FIELDS: FieldDef[] = [
  {
    name: 'facilityName',
    label: 'Facility name',
    required: true,
    minLength: 2,
    maxLength: 120,
    placeholder: 'e.g. City Care Hospital',
    autoComplete: 'organization',
  },
  {
    name: 'facilityAddress',
    label: 'Facility address',
    required: true,
    minLength: 3,
    maxLength: 240,
    placeholder: 'Street, area, city',
    autoComplete: 'street-address',
  },
  {
    name: 'facilityPhone',
    label: 'Facility phone',
    type: 'tel',
    maxLength: 30,
    placeholder: '+91 98765 43210',
    autoComplete: 'tel',
  },
  {
    name: 'facilityType',
    label: 'Facility type',
    control: 'select',
    options: [
      { value: 'HOSPITAL', label: 'Hospital' },
      { value: 'HEALTH_POST', label: 'Health post' },
    ],
  },
  {
    name: 'operatingHours',
    label: 'Operating hours',
    maxLength: 300,
    placeholder: 'Mon–Sat · 8:00 am – 8:00 pm',
  },
];

const AMBULANCE_FIELDS: FieldDef[] = [
  {
    name: 'driverName',
    label: 'Driver name',
    required: true,
    minLength: 2,
    maxLength: 60,
    placeholder: 'Full name on the transport license',
    autoComplete: 'name',
  },
  {
    name: 'phone',
    label: 'Dispatch contact phone',
    type: 'tel',
    maxLength: 30,
    placeholder: '+91 98765 43210',
    autoComplete: 'tel',
  },
  {
    name: 'driverPhone',
    label: 'Driver phone',
    type: 'tel',
    maxLength: 30,
    placeholder: '+91 98765 43210',
    autoComplete: 'tel',
  },
];

export const REGISTER_FIELDS: Record<string, FieldDef[]> = {
  DOCTOR: [
    {
      name: 'specialization',
      label: 'Specialization',
      required: true,
      minLength: 2,
      maxLength: 80,
      placeholder: 'e.g. Cardiology',
    },
    {
      name: 'licenseNumber',
      label: 'Medical license number',
      required: true,
      minLength: 3,
      maxLength: 60,
      placeholder: 'e.g. MH-2024-012345',
    },
    {
      name: 'bio',
      label: 'Bio',
      control: 'textarea',
      maxLength: 500,
      rows: 3,
      placeholder: 'A short introduction shown to patients (optional)',
    },
    {
      name: 'phone',
      label: 'Contact phone',
      type: 'tel',
      maxLength: 30,
      placeholder: '+91 98765 43210',
      autoComplete: 'tel',
    },
  ],
  FACILITY_STAFF: [...FACILITY_FIELDS],
  AMBULANCE_OPERATOR: [...AMBULANCE_FIELDS],
};

export const RESUBMIT_FIELDS: Record<string, FieldDef[]> = {
  DOCTOR: [
    {
      name: 'specialization',
      label: 'Specialization',
      required: true,
      minLength: 2,
      maxLength: 80,
      placeholder: 'e.g. Cardiology',
    },
    {
      name: 'licenseNumber',
      label: 'Medical license number',
      required: true,
      minLength: 3,
      maxLength: 60,
      placeholder: 'e.g. MH-2024-012345',
    },
    {
      name: 'bio',
      label: 'Bio',
      control: 'textarea',
      maxLength: 500,
      rows: 3,
      placeholder: 'A short introduction shown to patients',
    },
  ],
  FACILITY_STAFF: [...FACILITY_FIELDS],
  AMBULANCE_OPERATOR: [...AMBULANCE_FIELDS],
};

export function Field({
  def,
  error,
  defaultValue,
}: {
  def: FieldDef;
  error?: string | null;
  defaultValue?: string;
}) {
  const controlId = def.name;
  const errorId = `${controlId}-error`;
  const shared = {
    id: controlId,
    name: def.name,
    required: def.required === true,
    minLength: def.minLength,
    maxLength: def.maxLength,
    placeholder: def.placeholder,
    autoComplete: def.autoComplete,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  return (
    <div>
      <label htmlFor={controlId} className="mb-1.5 block text-sm font-semibold text-ink">
        {def.label}
        {def.required ? (
          <span className="text-danger"> *</span>
        ) : def.control !== 'select' ? (
          <span className="font-normal text-ink-subtle"> (optional)</span>
        ) : null}
      </label>
      {def.control === 'textarea' ? (
        <textarea {...shared} rows={def.rows ?? 3} defaultValue={defaultValue} className={`${inputClass} resize-y`} />
      ) : def.control === 'select' ? (
        <select {...shared} defaultValue={defaultValue ?? def.options?.[0]?.value} className={inputClass}>
          {def.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input {...shared} type={def.type ?? 'text'} defaultValue={defaultValue} className={inputClass} />
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

import AuthShell from '@/components/AuthShell';
import AuthForm from '@/components/AuthForm';

export default async function Page({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to access your care, appointments and records.">
      {reason === 'expired' && (
        <p
          role="status"
          className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-200"
        >
          You were signed out because your session ended. Please sign in again.
        </p>
      )}
      <AuthForm mode="login" />
    </AuthShell>
  );
}

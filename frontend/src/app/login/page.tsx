import AuthShell from '@/components/AuthShell';
import AuthForm from '@/components/AuthForm';

export default function Page() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to access your care, appointments and records.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
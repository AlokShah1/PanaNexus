import AuthShell from '@/components/AuthShell';
import AuthForm from '@/components/AuthForm';

export default function Page() {
  return (
    <AuthShell title="Create your account" subtitle="Choose how you use PanaNexus so we can tailor your experience.">
      <AuthForm mode="register" />
    </AuthShell>
  );
}
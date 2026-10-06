import AuthForm from '@/frontend/components/AuthForm';

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center px-5 py-16">
      <AuthForm mode="login" />
    </main>
  );
}

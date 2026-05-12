import Link from "next/link";
import { LoginForm } from "@/components/forms";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Welcome back.
          </p>
        </header>
        <LoginForm />
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No account?{" "}
          <Link href="/signup" className="font-medium underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

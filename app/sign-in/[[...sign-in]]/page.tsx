import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <div className="auth-brand"><div className="brand-mark">✦</div><div><strong>Pocket<span>pals</span></strong><small>your money, but cuter</small></div></div>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </main>
  );
}

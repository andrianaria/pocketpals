import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <div className="auth-brand"><div className="brand-mark">✦</div><div><strong>Pocket<span>pals</span></strong><small>your money, but cuter</small></div></div>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </main>
  );
}

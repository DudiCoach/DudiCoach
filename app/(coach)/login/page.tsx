import { pl } from "@/lib/i18n/pl";
import {
  DudiCoachLogo,
  DudiCoachWordmark,
} from "@/components/brand/DudiCoachBrand";

import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="bg-background flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-card border-border rounded-card border p-8 shadow-xl shadow-black/20">
          <div className="mb-6 space-y-3">
            <DudiCoachLogo priority size={80} />
            <DudiCoachWordmark className="block text-xl text-primary" />
          </div>
          <h1 className="text-foreground mb-2 text-2xl font-semibold tracking-tight">
            {pl.auth.login.title}
          </h1>
          <p className="text-muted-foreground mb-8 text-sm">
            {pl.auth.login.subtitle}
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

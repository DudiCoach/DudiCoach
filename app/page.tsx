import Link from "next/link";

import {
  DudiCoachLogo,
  DudiCoachWordmark,
} from "@/components/brand/DudiCoachBrand";
import { pl } from "@/lib/i18n/pl";
import ShareCodeForm from "@/components/home/ShareCodeForm";

export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md space-y-6 rounded-card border border-border bg-card p-8 shadow-xl shadow-black/20">
        <div className="space-y-4">
          <DudiCoachLogo priority size={96} />
          <h1 className="text-2xl font-semibold text-foreground">
            <DudiCoachWordmark />
          </h1>
          <p className="text-sm text-muted-foreground">{pl.home.description}</p>
        </div>

        <ShareCodeForm />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{pl.home.or}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Link
          href="/login"
          className="inline-flex w-full items-center justify-center rounded-input bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {pl.home.coachLoginCta}
        </Link>
      </div>
    </main>
  );
}

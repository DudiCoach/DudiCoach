import { DudiCoachWordmark } from "@/components/brand/DudiCoachBrand";
import { pl } from "@/lib/i18n/pl";

import LogoutButton from "./LogoutButton";

interface CoachNavbarProps {
  displayName: string;
}

export default function CoachNavbar({ displayName }: CoachNavbarProps) {
  return (
    <header className="bg-card border-border sticky top-0 z-10 border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* Compact text wordmark avoids using the non-transparent PNG as a tile. */}
        <DudiCoachWordmark className="text-base text-primary" />

        {/* Right side: greeting + logout */}
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground hidden text-sm sm:block">
            {`${pl.coach.navbar.greeting} ${displayName}`}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

import Image from "next/image";

import { pl } from "@/lib/i18n/pl";
import { cn } from "@/lib/utils";

interface DudiCoachWordmarkProps {
  className?: string;
}

interface DudiCoachLogoProps {
  className?: string;
  priority?: boolean;
  size?: number;
}

export function DudiCoachWordmark({ className }: DudiCoachWordmarkProps) {
  return (
    <span
      className={cn("font-semibold tracking-tight text-foreground", className)}
    >
      {pl.home.title}
    </span>
  );
}

export function DudiCoachLogo({
  className,
  priority = false,
  size = 88,
}: DudiCoachLogoProps) {
  return (
    <Image
      src="/dudi-coach-dm-logo.png"
      alt={pl.home.title}
      width={size}
      height={size}
      priority={priority}
      className={cn("rounded-card object-cover", className)}
    />
  );
}

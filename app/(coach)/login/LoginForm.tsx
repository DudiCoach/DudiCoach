"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { pl } from "@/lib/i18n/pl";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { signInWithEmail } from "@/lib/firebase/auth";

export default function LoginForm() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onTouched",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  async function onSubmit(data: LoginInput) {
    setIsPending(true);
    form.clearErrors("root");

    try {
      const userCredential = await signInWithEmail(
        data.email,
        data.password,
      );

      const idToken = await userCredential.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) {
        form.setError("root", {
          message: pl.auth.login.errorGeneric,
        });
        setIsPending(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (
        e.code === "auth/invalid-credential" ||
        e.code === "auth/user-not-found" ||
        e.code === "auth/wrong-password"
      ) {
        form.resetField("password");
        form.setError("root", { message: pl.auth.login.errorInvalid });
      } else if (e.code === "auth/network-request-failed") {
        form.setError("root", { message: pl.auth.login.errorNetwork });
      } else {
        form.setError("root", { message: pl.auth.login.errorGeneric });
      }
      setIsPending(false);
    }
  }

  const isDisabled = isPending || isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      {/* Email field */}
      <div className="mb-5">
        <label
          htmlFor="email"
          className="text-foreground mb-1.5 block text-sm font-medium"
        >
          {pl.auth.login.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          placeholder={pl.auth.login.emailPlaceholder}
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
          className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isDisabled}
          {...register("email")}
        />
        {errors.email && (
          <p
            id="email-error"
            role="alert"
            className="text-destructive mt-1.5 text-xs"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="mb-6">
        <label
          htmlFor="password"
          className="text-foreground mb-1.5 block text-sm font-medium"
        >
          {pl.auth.login.passwordLabel}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder={pl.auth.login.passwordPlaceholder}
          aria-invalid={errors.password ? "true" : "false"}
          aria-describedby={errors.password ? "password-error" : undefined}
          className="border-border bg-input text-foreground rounded-input w-full border px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isDisabled}
          {...register("password")}
        />
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="text-destructive mt-1.5 text-xs"
          >
            {errors.password.message}
          </p>
        )}
      </div>

      {/* Root / server error alert */}
      {errors.root && (
        <div
          role="alert"
          className="bg-destructive/10 border-destructive/30 text-destructive rounded-input mb-5 border px-4 py-3 text-sm"
        >
          {errors.root.message}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isDisabled}
        className="bg-primary text-primary-foreground rounded-input w-full py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending || isSubmitting
          ? pl.auth.login.submitting
          : pl.auth.login.submitButton}
      </button>
    </form>
  );
}

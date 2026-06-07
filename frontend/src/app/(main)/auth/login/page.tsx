"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Command } from "lucide-react";
import { useTranslations } from "@/i18n/provider";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isOidc, loginLocal, redirectToOidc, setToken } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  if (isOidc) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background p-8">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Command className="size-8" />
            </div>
            <CardTitle>{t("signIn")}</CardTitle>
            <CardDescription>{t("useOrgAccount")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={redirectToOidc}>
              {t("continueWithSso")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function onSubmit(values: FormValues) {
    try {
      const token = await loginLocal(values.email, values.password);
      setToken(token);
      router.replace("/dashboard");
    } catch (err) {
      form.setError("root", {
        message: err instanceof Error ? err.message : t("loginError"),
      });
    }
  }

  return (
    <div className="flex h-dvh">
      <div className="hidden bg-primary lg:flex lg:w-1/3 items-center justify-center p-12">
        <div className="space-y-4 text-center">
          <Command className="mx-auto size-12 text-primary-foreground" />
          <h1 className="font-light text-4xl text-primary-foreground">{t("welcomeBack")}</h1>
          <p className="text-primary-foreground/80">{t("signInToContinue")}</p>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold tracking-tight">{t("signIn")}</h2>
            <p className="text-muted-foreground text-sm mt-2">{t("enterCredentials")}</p>
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("email")}</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t("emailPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("password")}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={t("passwordPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("signingIn") : t("signIn")}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

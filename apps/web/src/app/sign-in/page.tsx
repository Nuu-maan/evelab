import { redirect } from "next/navigation";
import { IconLogoGithub } from "@/components/icons";
import { Icon } from "@/components/icon";
import { Mark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signInAction } from "@/lib/actions";
import { getAccount, isAuthEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!isAuthEnabled() || (await getAccount())) redirect("/projects");

  return (
    <main className="main grid min-h-screen place-items-center p-6" id="main">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Mark />
          <CardTitle className="mt-3 text-lg">Sign in to EveLab</CardTitle>
          <CardDescription>
            Your projects are private to your account. EveLab reads your GitHub name and email to
            create it and never asks for repository access here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signInAction}>
            <Button type="submit" className="w-full">
              <Icon icon={IconLogoGithub} />
              Continue with GitHub
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

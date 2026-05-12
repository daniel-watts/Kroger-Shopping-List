import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@kroger/db";
import { encryptToString } from "@kroger/crypto";
import { exchangeCode } from "@kroger/shared";
import { krogerEnv } from "@/lib/kroger";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const back = (msg: string) =>
    Response.redirect(`${url.origin}/settings?krogerError=${encodeURIComponent(msg)}`, 302);

  if (error) return back(error);
  if (!code || !state) return back("missing_code_or_state");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("kr_state")?.value;
  const verifier = cookieStore.get("kr_verifier")?.value;
  cookieStore.delete("kr_state");
  cookieStore.delete("kr_verifier");

  if (!expectedState || !verifier || expectedState !== state) {
    return back("state_mismatch");
  }

  try {
    const { clientId, clientSecret, redirectUri } = krogerEnv();
    const tokens = await exchangeCode({
      clientId,
      clientSecret,
      redirectUri,
      code,
      codeVerifier: verifier,
    });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await prisma.krogerOAuth.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        accessTokenEnc: encryptToString(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? encryptToString(tokens.refresh_token)
          : null,
        expiresAt,
        scopes: tokens.scope ?? "",
      },
      update: {
        accessTokenEnc: encryptToString(tokens.access_token),
        refreshTokenEnc: tokens.refresh_token
          ? encryptToString(tokens.refresh_token)
          : null,
        expiresAt,
        scopes: tokens.scope ?? "",
      },
    });
  } catch (e) {
    console.error("kroger oauth exchange failed:", e);
    return back("exchange_failed");
  }

  return Response.redirect(`${url.origin}/settings?krogerConnected=1`, 302);
}

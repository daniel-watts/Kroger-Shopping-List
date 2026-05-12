import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  DEFAULT_SCOPES,
  buildAuthorizeUrl,
  generatePkcePair,
  generateState,
} from "@kroger/shared";
import { krogerEnv } from "@/lib/kroger";

const TEN_MINUTES = 10 * 60;

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { clientId, redirectUri } = krogerEnv();
  const { verifier, challenge } = generatePkcePair();
  const state = generateState();

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: TEN_MINUTES,
  };
  cookieStore.set("kr_state", state, cookieOpts);
  cookieStore.set("kr_verifier", verifier, cookieOpts);

  const url = buildAuthorizeUrl({
    clientId,
    redirectUri,
    scopes: DEFAULT_SCOPES,
    state,
    codeChallenge: challenge,
  });

  return Response.redirect(url, 302);
}

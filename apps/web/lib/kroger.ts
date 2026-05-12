import { prisma } from "@kroger/db";
import { decryptFromString, encryptToString } from "@kroger/crypto";
import { KrogerApiError, refreshAccessToken } from "@kroger/shared";

export const krogerEnv = (): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} => {
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  const redirectUri =
    process.env.KROGER_REDIRECT_URI ??
    "http://localhost:3000/api/kroger/callback";
  if (!clientId || !clientSecret) {
    throw new Error(
      "KROGER_CLIENT_ID / KROGER_CLIENT_SECRET not set in environment.",
    );
  }
  return { clientId, clientSecret, redirectUri };
};

const REFRESH_BUFFER_MS = 60_000;

/**
 * Returns a valid access token for the user, refreshing if necessary.
 * Returns null if the user has no Kroger connection or the refresh token is gone.
 */
export const getValidAccessToken = async (
  userId: string,
): Promise<string | null> => {
  const row = await prisma.krogerOAuth.findUnique({ where: { userId } });
  if (!row) return null;

  if (row.expiresAt.getTime() - REFRESH_BUFFER_MS > Date.now()) {
    return decryptFromString(row.accessTokenEnc);
  }

  if (!row.refreshTokenEnc) return null;

  const { clientId, clientSecret } = krogerEnv();
  const refreshToken = decryptFromString(row.refreshTokenEnc);
  try {
    const refreshed = await refreshAccessToken({
      clientId,
      clientSecret,
      refreshToken,
    });
    await prisma.krogerOAuth.update({
      where: { userId },
      data: {
        accessTokenEnc: encryptToString(refreshed.access_token),
        refreshTokenEnc: refreshed.refresh_token
          ? encryptToString(refreshed.refresh_token)
          : row.refreshTokenEnc,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        scopes: refreshed.scope ?? row.scopes,
      },
    });
    return refreshed.access_token;
  } catch (e) {
    console.error("kroger token refresh failed:", e);
    // 401 from Kroger's token endpoint means the refresh token is dead
    // (rotated/revoked/expired). Drop the row so the user is prompted to
    // reconnect on the next page load.
    if (e instanceof KrogerApiError && e.status === 401) {
      await prisma.krogerOAuth
        .delete({ where: { userId } })
        .catch(() => undefined);
    }
    return null;
  }
};

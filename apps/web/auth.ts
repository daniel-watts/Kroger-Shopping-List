import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@kroger/db";
import { authConfig } from "./auth.config";
import { verifyPassword } from "./lib/password";
import { LoginSchema } from "./lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      authorize: async (raw) => {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
});

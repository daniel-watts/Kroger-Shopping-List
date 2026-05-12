"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@kroger/db";

export async function disconnectKrogerAction() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await prisma.krogerOAuth.deleteMany({ where: { userId: session.user.id } });
  revalidatePath("/settings");
}

export async function setHomeStoreAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const locationId = String(formData.get("locationId") ?? "");
  if (!locationId) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { homeLocationId: locationId },
  });
  redirect("/settings");
}

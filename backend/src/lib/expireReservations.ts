import prisma from "./prisma";

export async function expireReservations(): Promise<{ expired: number }> {
  const now = new Date();

  const stale = await prisma.registration.findMany({
    where: { status: "RESERVED", expiresAt: { lte: now } },
    select: { id: true, sessionId: true },
  });

  if (!stale.length) return { expired: 0 };

  await prisma.$transaction(async (tx) => {
    for (const reg of stale) {
      await tx.registration.update({
        where: { id: reg.id },
        data: { status: "EXPIRED", expiresAt: null },
      });
      await tx.registrationEvent.create({
        data: {
          registrationId: reg.id,
          oldStatus: "RESERVED",
          newStatus: "EXPIRED",
          changedBy: null,
          note: "Auto-expired by cron sweep",
        },
      });
    }
  });

  return { expired: stale.length };
}

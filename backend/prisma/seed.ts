import { PrismaClient, RegistrationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();


function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function dateOnly(n: number): Date {
  const d = daysFromNow(n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atHour(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function pastDate(daysAgo: number): Date {
  return daysFromNow(-daysAgo);
}


async function main() {
  await prisma.alertDismissal.deleteMany();
  await prisma.registrationEvent.deleteMany();
  await prisma.registration.deleteMany();
  await prisma.staffAssignment.deleteMany();
  await prisma.session.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();


  const hash = (pw: string) => bcrypt.hashSync(pw, 12);

  const organizer = await prisma.user.create({
    data: { email: "organizer@test.com", passwordHash: hash("Password123"), role: "ORGANIZER" },
  });

  await prisma.user.create({
    data: { email: "organizer2@test.com", passwordHash: hash("Password123"), role: "ORGANIZER" },
  });

  const staff1 = await prisma.user.create({
    data: { email: "staff1@test.com", passwordHash: hash("Password123"), role: "STAFF" },
  });

  const staff2 = await prisma.user.create({
    data: { email: "staff2@test.com", passwordHash: hash("Password123"), role: "STAFF" },
  });

  const staff3 = await prisma.user.create({
    data: { email: "staff3@test.com", passwordHash: hash("Password123"), role: "STAFF" },
  });

  // ── EVENTS ─────────────────────────────────────────────────────────────────

  // Active upcoming event
  const techConf = await prisma.event.create({
    data: {
      name: "TechConf 2026",
      description: "Annual technology conference covering AI, cloud, and web development trends.",
      startDate: dateOnly(5),
      endDate: dateOnly(7),
      venue: "Grand Convention Centre, Floor 3",
      archived: false,
    },
  });

  // Active event starting today (for dashboard "sessions today")
  const workshopDay = await prisma.event.create({
    data: {
      name: "Developer Workshop Day",
      description: "Hands-on workshops for engineers. Small groups, practical focus.",
      startDate: dateOnly(0),
      endDate: dateOnly(0),
      venue: "Innovation Hub, Room A–D",
      archived: false,
    },
  });

  // Past event (for history, expired registrations, check-ins)
  const pastConf = await prisma.event.create({
    data: {
      name: "Spring Summit 2026",
      description: "Spring edition covering product strategy and engineering best practices.",
      startDate: dateOnly(-14),
      endDate: dateOnly(-12),
      venue: "City Hall Auditorium",
      archived: false,
    },
  });

  // Archived event
  const archivedEvent = await prisma.event.create({
    data: {
      name: "Legacy Systems Summit",
      description: "Archived conference — kept for historical records.",
      startDate: dateOnly(-60),
      endDate: dateOnly(-58),
      venue: "Old Town Centre",
      archived: true,
    },
  });


  const tcDay1 = dateOnly(5);
  const tcDay2 = dateOnly(6);

  const tcKeynote = await prisma.session.create({
    data: {
      eventId: techConf.id,
      title: "Opening Keynote",
      startTime: atHour(tcDay1, 9, 0),
      durationMinutes: 60,
      location: "Main Hall",
      capacity: 200,
    },
  });

  const tcAI = await prisma.session.create({
    data: {
      eventId: techConf.id,
      title: "AI in Production",
      startTime: atHour(tcDay1, 11, 0),
      durationMinutes: 90,
      location: "Room 301",
      capacity: 5,
    },
  });

  const tcCloud = await prisma.session.create({
    data: {
      eventId: techConf.id,
      title: "Cloud Architecture Patterns",
      startTime: atHour(tcDay1, 14, 0),
      durationMinutes: 90,
      location: "Room 302",
      capacity: 30,
    },
  });

  const tcWebDev = await prisma.session.create({
    data: {
      eventId: techConf.id,
      title: "Modern Web Development",
      startTime: atHour(tcDay2, 10, 0),
      durationMinutes: 120,
      location: "Room 303",
      capacity: 25,
    },
  });

  const tcSecurity = await prisma.session.create({
    data: {
      eventId: techConf.id,
      title: "Security Best Practices",
      startTime: atHour(tcDay2, 14, 0),
      durationMinutes: 60,
      location: "Room 304",
      capacity: 20,
    },
  });

  const wdToday = dateOnly(0);

  const wdReact = await prisma.session.create({
    data: {
      eventId: workshopDay.id,
      title: "React Advanced Patterns",
      startTime: atHour(wdToday, 9, 30),
      durationMinutes: 180,
      location: "Room A",
      capacity: 15,
    },
  });

  const wdDocker = await prisma.session.create({
    data: {
      eventId: workshopDay.id,
      title: "Docker & Kubernetes Hands-On",
      startTime: atHour(wdToday, 13, 0),
      durationMinutes: 180,
      location: "Room B",
      capacity: 10,
    },
  });

  const wdDB = await prisma.session.create({
    data: {
      eventId: workshopDay.id,
      title: "Database Performance Tuning",
      startTime: atHour(wdToday, 9, 30),
      durationMinutes: 120,
      location: "Room C",
      capacity: 3,
    },
  });

  const pastDay1 = dateOnly(-14);
  const pastDay2 = dateOnly(-13);

  const pastKeynote = await prisma.session.create({
    data: {
      eventId: pastConf.id,
      title: "Spring Keynote",
      startTime: atHour(pastDay1, 10, 0),
      durationMinutes: 60,
      location: "Main Auditorium",
      capacity: 100,
    },
  });

  const pastProduct = await prisma.session.create({
    data: {
      eventId: pastConf.id,
      title: "Product Strategy Workshop",
      startTime: atHour(pastDay1, 14, 0),
      durationMinutes: 120,
      location: "Workshop Room 1",
      capacity: 20,
    },
  });

  const pastDevOps = await prisma.session.create({
    data: {
      eventId: pastConf.id,
      title: "DevOps Culture",
      startTime: atHour(pastDay2, 11, 0),
      durationMinutes: 90,
      location: "Workshop Room 2",
      capacity: 15,
    },
  });

  const archSession = await prisma.session.create({
    data: {
      eventId: archivedEvent.id,
      title: "Legacy Code Modernisation",
      startTime: atHour(dateOnly(-58), 10, 0),
      durationMinutes: 120,
      location: "Main Hall",
      capacity: 50,
    },
  });


  await prisma.staffAssignment.createMany({
    data: [
      { userId: staff1.id, sessionId: wdReact.id },
      { userId: staff1.id, sessionId: wdDocker.id },
      { userId: staff1.id, sessionId: tcAI.id },
      { userId: staff1.id, sessionId: tcKeynote.id },
    ],
  });

  await prisma.staffAssignment.createMany({
    data: [
      { userId: staff2.id, sessionId: tcCloud.id },
      { userId: staff2.id, sessionId: tcWebDev.id },
      { userId: staff2.id, sessionId: tcSecurity.id },
      { userId: staff2.id, sessionId: wdDB.id },
    ],
  });

  await prisma.staffAssignment.createMany({
    data: [
      { userId: staff3.id, sessionId: pastKeynote.id },
      { userId: staff3.id, sessionId: pastProduct.id },
      { userId: staff3.id, sessionId: pastDevOps.id },
    ],
  });


  async function createReg(
    sessionId: string,
    name: string,
    email: string,
    status: RegistrationStatus,
    reservedDaysAgo: number,
    actor: { id: string } = organizer,
    expiresInMinutes?: number
  ) {
    const reservedAt = pastDate(reservedDaysAgo);
    const expiresAt =
      expiresInMinutes !== undefined
        ? new Date(reservedAt.getTime() + expiresInMinutes * 60_000)
        : status === "RESERVED"
        ? new Date(Date.now() + 15 * 60_000)
        : undefined;

    const reg = await prisma.registration.create({
      data: { sessionId, attendeeName: name, attendeeEmail: email, status, reservedAt, expiresAt },
    });

    await prisma.registrationEvent.create({
      data: {
        registrationId: reg.id,
        oldStatus: null,
        newStatus: "RESERVED",
        changedBy: actor.id,
        note: "Registration created",
      },
    });

    if (status === "CONFIRMED" || status === "CHECKED_IN") {
      await prisma.registrationEvent.create({
        data: {
          registrationId: reg.id,
          oldStatus: "RESERVED",
          newStatus: "CONFIRMED",
          changedBy: actor.id,
          note: null,
        },
      });
    }
    if (status === "CHECKED_IN") {
      await prisma.registrationEvent.create({
        data: {
          registrationId: reg.id,
          oldStatus: "CONFIRMED",
          newStatus: "CHECKED_IN",
          changedBy: actor.id,
          note: "Checked in at door",
        },
      });
    }
    if (status === "CANCELLED") {
      await prisma.registrationEvent.create({
        data: {
          registrationId: reg.id,
          oldStatus: "RESERVED",
          newStatus: "CANCELLED",
          changedBy: actor.id,
          note: "Attendee requested cancellation",
        },
      });
    }
    if (status === "EXPIRED") {
      await prisma.registrationEvent.create({
        data: {
          registrationId: reg.id,
          oldStatus: "RESERVED",
          newStatus: "EXPIRED",
          changedBy: null,
          note: "Reservation expired automatically",
        },
      });
    }

    return reg;
  }

  // TechConf: AI in Production (capacity 5 — filled completely → triggers alert)
  await createReg(tcAI.id, "Alice Johnson",   "alice@example.com",   "CONFIRMED",   3, organizer);
  await createReg(tcAI.id, "Bob Martinez",    "bob@example.com",     "CONFIRMED",   3, organizer);
  await createReg(tcAI.id, "Carol White",     "carol@example.com",   "CHECKED_IN",  4, organizer);
  await createReg(tcAI.id, "David Brown",     "david@example.com",   "RESERVED",    1, organizer);
  await createReg(tcAI.id, "Eve Davis",       "eve@example.com",     "RESERVED",    1, organizer);
  await prisma.session.update({ where: { id: tcAI.id }, data: { capacityFillEpoch: 1 } });

  // TechConf: Opening Keynote
  const keynoteAttendees = [
    ["Frank Lee",       "frank@example.com",     "CONFIRMED"],
    ["Grace Kim",       "grace@example.com",     "CONFIRMED"],
    ["Henry Wilson",    "henry@example.com",     "RESERVED"],
    ["Isla Thompson",   "isla@example.com",      "RESERVED"],
    ["Jack Garcia",     "jack@example.com",      "CANCELLED"],
    ["Karen Martinez",  "karen@example.com",     "RESERVED"],
    ["Liam Anderson",   "liam@example.com",      "CONFIRMED"],
    ["Mia Taylor",      "mia@example.com",       "CONFIRMED"],
    ["Noah Harris",     "noah@example.com",      "RESERVED"],
    ["Olivia Martin",   "olivia@example.com",    "CONFIRMED"],
  ] as const;
  for (const [name, email, status] of keynoteAttendees) {
    await createReg(tcKeynote.id, name, email, status, 4, organizer);
  }

  // TechConf: Cloud Architecture
  const cloudAttendees = [
    ["Pam Clark",       "pam@example.com",    "CONFIRMED"],
    ["Quinn Lewis",     "quinn@example.com",  "RESERVED"],
    ["Rachel Robinson", "rachel@example.com", "CANCELLED"],
    ["Sam Walker",      "sam@example.com",    "RESERVED"],
    ["Tina Hall",       "tina@example.com",   "CONFIRMED"],
  ] as const;
  for (const [name, email, status] of cloudAttendees) {
    await createReg(tcCloud.id, name, email, status, 3, organizer);
  }

  // TechConf: Web Dev
  await createReg(tcWebDev.id, "Uma Young",    "uma@example.com",    "RESERVED",  2, organizer);
  await createReg(tcWebDev.id, "Victor Allen", "victor@example.com", "CONFIRMED", 2, organizer);
  await createReg(tcWebDev.id, "Wendy King",   "wendy@example.com",  "RESERVED",  1, organizer);

  // Workshop Day: React
  const reactAttendees = [
    ["Xander Scott",   "xander@example.com",  "CHECKED_IN"],
    ["Yara Adams",     "yara@example.com",     "CHECKED_IN"],
    ["Zoe Baker",      "zoe@example.com",      "CHECKED_IN"],
    ["Aaron Nelson",   "aaron@example.com",    "CONFIRMED"],
    ["Beth Carter",    "beth@example.com",     "CONFIRMED"],
    ["Carlos Mitchell","carlos@example.com",   "RESERVED"],
  ] as const;
  for (const [name, email, status] of reactAttendees) {
    await createReg(wdReact.id, name, email, status, 2, organizer);
  }

  // Workshop Day: Docker
  await createReg(wdDocker.id, "Diana Perez",   "diana@example.com",  "CHECKED_IN", 2, organizer);
  await createReg(wdDocker.id, "Ethan Roberts", "ethan@example.com",  "CHECKED_IN", 2, organizer);
  await createReg(wdDocker.id, "Fiona Turner",  "fiona@example.com",  "CONFIRMED",  1, organizer);

  // Workshop Day: DB Perf Tuning (capacity 3 — filled → alert, then dismissed)
  await createReg(wdDB.id, "George Phillips", "george@example.com", "CONFIRMED", 2, organizer);
  await createReg(wdDB.id, "Hannah Campbell", "hannah@example.com", "CONFIRMED", 2, organizer);
  await createReg(wdDB.id, "Ian Parker",      "ian@example.com",    "RESERVED",  1, organizer);
  await prisma.session.update({ where: { id: wdDB.id }, data: { capacityFillEpoch: 1 } });

  // Past event: Spring Keynote
  const pastKeynoteAttendees = [
    ["Jane Evans",    "jane.e@example.com",  "CHECKED_IN"],
    ["Kyle Edwards",  "kyle@example.com",    "CHECKED_IN"],
    ["Laura Collins", "laura@example.com",   "CHECKED_IN"],
    ["Mike Stewart",  "mike@example.com",    "CHECKED_IN"],
    ["Nina Sanchez",  "nina@example.com",    "CANCELLED"],
    ["Oscar Morris",  "oscar@example.com",   "EXPIRED"],
    ["Paula Rogers",  "paula@example.com",   "EXPIRED"],
    ["Ray Reed",      "ray@example.com",     "CHECKED_IN"],
  ] as const;
  for (const [name, email, status] of pastKeynoteAttendees) {
    await createReg(pastKeynote.id, name, email, status, 20, organizer);
  }

  // Past event: Product Strategy
  const pastProductAttendees = [
    ["Sara Cook",    "sara@example.com",    "CHECKED_IN"],
    ["Tom Morgan",   "tom@example.com",     "CHECKED_IN"],
    ["Uma Bell",     "uma2@example.com",    "CHECKED_IN"],
    ["Vince Murphy", "vince@example.com",   "EXPIRED"],
    ["Wendy Bailey", "wendy2@example.com",  "CANCELLED"],
  ] as const;
  for (const [name, email, status] of pastProductAttendees) {
    await createReg(pastProduct.id, name, email, status, 18, organizer);
  }

  // Past event: DevOps Culture
  await createReg(pastDevOps.id, "Xena Rivera",     "xena@example.com",  "CHECKED_IN", 16, organizer);
  await createReg(pastDevOps.id, "Yuri Cooper",     "yuri@example.com",  "CHECKED_IN", 16, organizer);
  await createReg(pastDevOps.id, "Zara Richardson", "zara@example.com",  "EXPIRED",    16, organizer);

  // Archived event
  await createReg(archSession.id, "Alan Peterson", "alan@example.com",   "CHECKED_IN", 65, organizer);
  await createReg(archSession.id, "Brenda Gray",   "brenda@example.com", "EXPIRED",    65, organizer);

  // Extra EXPIRED registrations this week (for dashboard "expired this week" counter)
  for (let i = 1; i <= 4; i++) {
    await createReg(tcCloud.id, `Expired User ${i}`, `expired${i}@example.com`, "EXPIRED", 2, organizer);
  }


  // Dismiss the wdDB alert — tcAI alert stays active and visible in the alerts panel
  await prisma.alertDismissal.create({
    data: {
      sessionId: wdDB.id,
      fillEpoch: 1,
      dismissedBy: organizer.id,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

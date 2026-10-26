import { PrismaClient } from "@prisma/client";
import { pathToFileURL } from "node:url";

const samplePoliticians = [
  {
    slug: "gavin-newsom",
    fullName: "Gavin Newsom",
    officeTitle: "Governor of California",
    party: "Democratic",
    district: "Statewide",
  },
  {
    slug: "rob-bonta",
    fullName: "Rob Bonta",
    officeTitle: "Attorney General of California",
    party: "Democratic",
    district: "Statewide",
  },
  {
    slug: "eleni-kounalakis",
    fullName: "Eleni Kounalakis",
    officeTitle: "Lieutenant Governor of California",
    party: "Democratic",
    district: "Statewide",
  },
  {
    slug: "scott-wiener",
    fullName: "Scott Wiener",
    officeTitle: "California State Senator",
    party: "Democratic",
    district: "District 11",
  },
  {
    slug: "buffy-wicks",
    fullName: "Buffy Wicks",
    officeTitle: "California State Assemblymember",
    party: "Democratic",
    district: "District 14",
  },
  {
    slug: "shannon-grove",
    fullName: "Shannon Grove",
    officeTitle: "California State Senator",
    party: "Republican",
    district: "District 16",
  },
];

export async function seedDatabase(prisma, log = console.log) {
  const state = await prisma.jurisdiction.upsert({
    where: { legistarClientId: "ca-state" },
    create: {
      name: "State of California",
      type: "STATE",
      legistarClientId: "ca-state",
    },
    update: {},
  });

  for (const p of samplePoliticians) {
    await prisma.politician.upsert({
      where: { slug: p.slug },
      create: {
        ...p,
        jurisdictionId: state.id,
      },
      update: {
        fullName: p.fullName,
        officeTitle: p.officeTitle,
        party: p.party,
        district: p.district,
        jurisdictionId: state.id,
      },
    });
  }

  log(`Seeded jurisdiction "${state.name}" and ${samplePoliticians.length} politicians.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();

  seedDatabase(prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

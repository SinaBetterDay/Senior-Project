import express from "express";

import { prisma } from "../../lib/prisma.js";

const router = express.Router();

const politicianSelect = {
  id: true,
  slug: true,
  fullName: true,
  officeTitle: true,
  district: true,
  needsReview: true,
  jurisdiction: { select: { id: true, name: true } },
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "politician";
}

function publicPolitician(politician) {
  return {
    id: politician.id,
    slug: politician.slug,
    name: politician.fullName,
    officeTitle: politician.officeTitle,
    district: politician.district,
    city: politician.jurisdiction?.name ?? "",
    needsReview: politician.needsReview,
    filingCount: politician._count?.filings ?? politician.filingCount ?? 0,
  };
}

function readBody(body) {
  const name = cleanString(body?.name);
  const district = cleanString(body?.district);
  const city = cleanString(body?.city);
  const officeTitle = cleanString(body?.officeTitle) || "Unknown";

  if (!name || !district || !city) {
    return { error: "Name, district, and city are required." };
  }
  if (name.length > 160 || district.length > 120 || city.length > 160) {
    return { error: "Name, district, or city is too long." };
  }

  return { value: { name, district, city, officeTitle } };
}

async function getOrCreateCity(name) {
  const existing = await prisma.jurisdiction.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const city = await prisma.jurisdiction.create({
    data: { name, type: "city" },
    select: { id: true },
  });
  return city.id;
}

async function uniqueSlug(name, excludeId) {
  const base = slugify(name);
  let slug = base;
  let suffix = 2;

  while (true) {
    const existing = await prisma.politician.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

router.get("/", async (_req, res, next) => {
  try {
    const politicians = await prisma.politician.findMany({
      orderBy: { fullName: "asc" },
      select: { ...politicianSelect, _count: { select: { filings: true } } },
    });
    return res.json({ data: politicians.map(publicPolitician) });
  } catch (error) {
    return next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = readBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const cityId = await getOrCreateCity(parsed.value.city);
    const slug = await uniqueSlug(parsed.value.name);
    const politician = await prisma.politician.create({
      data: {
        fullName: parsed.value.name,
        slug,
        officeTitle: parsed.value.officeTitle,
        district: parsed.value.district,
        jurisdictionId: cityId,
      },
      select: politicianSelect,
    });
    return res.status(201).json({ data: publicPolitician({ ...politician, filingCount: 0 }) });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "A politician with this profile slug already exists." });
    }
    return next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) {
      return res.status(400).json({ error: "Politician id must be a UUID." });
    }
    const parsed = readBody(req.body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const current = await prisma.politician.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { filings: true } } },
    });
    if (!current) return res.status(404).json({ error: "Politician not found." });

    const cityId = await getOrCreateCity(parsed.value.city);
    const slug = await uniqueSlug(parsed.value.name, current.id);
    const politician = await prisma.politician.update({
      where: { id: current.id },
      data: {
        fullName: parsed.value.name,
        slug,
        officeTitle: parsed.value.officeTitle,
        district: parsed.value.district,
        jurisdictionId: cityId,
      },
      select: politicianSelect,
    });
    return res.json({ data: publicPolitician({ ...politician, _count: current._count }) });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ error: "A politician with this profile slug already exists." });
    }
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!uuidPattern.test(req.params.id)) {
      return res.status(400).json({ error: "Politician id must be a UUID." });
    }
    const politician = await prisma.politician.findUnique({
      where: { id: req.params.id },
      select: { id: true, _count: { select: { filings: true } } },
    });
    if (!politician) return res.status(404).json({ error: "Politician not found." });
    if (politician._count.filings > 0) {
      return res.status(409).json({
        error: `This politician cannot be deleted because ${politician._count.filings} Form 700 filing(s) are linked to the profile.`,
        filing_count: politician._count.filings,
      });
    }

    await prisma.politician.delete({ where: { id: politician.id } });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default router;
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Example seed data — replace with your real models
  await prisma.politician.create({
    data: {
      name: "John Doe",
      party: "Independent",
      state: "CA",
    },
  })
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
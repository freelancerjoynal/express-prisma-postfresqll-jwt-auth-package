import { prisma } from './src/lib/prisma'
import 'dotenv/config';

async function main() {
  // Create a new user (without posts)
  const user = await prisma.user.create({
    data: {
      name: `${Math.random().toString(36).substring(2, 10)}`,
      email: `${Math.random().toString(36).substring(2, 10)}@prisma.io`,
    },
  })
  console.log('Created user:', user)

  // Fetch all users
  const allUsers = await prisma.user.findMany()
  console.log('All users:', JSON.stringify(allUsers, null, 2))
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
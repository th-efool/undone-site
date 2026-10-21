import { prisma } from '../src/server/infrastructure/db/postgres/client';

async function main() {
  console.log('Seeding @user_alpha and @user_gamma...');

  const alpha = await prisma.user.upsert({
    where: { email: 'user_alpha@undone.com' },
    update: {
      username: 'user_alpha',
      name: 'Alpha Explorer',
    },
    create: {
      email: 'user_alpha@undone.com',
      username: 'user_alpha',
      name: 'Alpha Explorer',
      role: 'EXPLORER',
      image: 'https://avatar.vercel.sh/user_alpha',
    },
  });

  const gamma = await prisma.user.upsert({
    where: { email: 'user_gamma@undone.com' },
    update: {
      username: 'user_gamma',
      name: 'Gamma Explorer',
    },
    create: {
      email: 'user_gamma@undone.com',
      username: 'user_gamma',
      name: 'Gamma Explorer',
      role: 'EXPLORER',
      image: 'https://avatar.vercel.sh/user_gamma',
    },
  });

  console.log('Successfully created/verified users:');
  console.log('User Alpha:', { id: alpha.id, name: alpha.name, email: alpha.email, username: alpha.username });
  console.log('User Gamma:', { id: gamma.id, name: gamma.name, email: gamma.email, username: gamma.username });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

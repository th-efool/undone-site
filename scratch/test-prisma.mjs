import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
    const user = await prisma.user.create({
        data: {
            email: "test@sidequesthq.in",
            username: "testuser",
            displayName: "Test User",
        },
    });

    console.log("Created user:", user);

    const found = await prisma.user.findUnique({
        where: {
            email: "test@sidequesthq.in",
        },
    });

    console.log("Found user:", found);

    await prisma.user.delete({
        where: {
            id: user.id,
        },
    });

    console.log("Cleaned up. Prisma + Postgres is working!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
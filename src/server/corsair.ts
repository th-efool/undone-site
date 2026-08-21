import "dotenv/config";

import { createCorsair } from "corsair";
import { github } from "@corsair-dev/github";
import { notion } from "@corsair-dev/notion";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

export const corsair = createCorsair({
    kek: process.env.CORSAIR_KEK!,
    database: pool,
    hub: {
        projectApiKey: process.env.CORSAIR_DEV_API_KEY!,
        signingSecret: process.env.CORSAIR_DEV_SIGNING_SECRET!,
    },
    plugins: [github(), notion()],
});

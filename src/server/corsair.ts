import "dotenv/config";

import { createCorsair } from "corsair";
import { github } from "@corsair-dev/github";
import { notion } from "@corsair-dev/notion";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

if (!process.env.CORSAIR_KEK || !process.env.CORSAIR_DEV_API_KEY || !process.env.CORSAIR_DEV_SIGNING_SECRET) {
    console.warn("Corsair environment variables are missing. Integrations may fail.");
}

export const corsair = createCorsair({
    kek: process.env.CORSAIR_KEK!,
    database: pool,
    hub: {
        projectApiKey: (process.env.NODE_ENV === 'production' 
            ? process.env.CORSAIR_PROD_API_KEY 
            : process.env.CORSAIR_DEV_API_KEY) || "",
        signingSecret: (process.env.NODE_ENV === 'production' 
            ? process.env.CORSAIR_PROD_SIGNING_SECRET 
            : process.env.CORSAIR_DEV_SIGNING_SECRET) || "",
    },
    plugins: [
        github(),
        notion({
            authType: "oauth_2",
            credentials: {
                clientId: process.env.NOTION_CLIENT_ID || "",
                clientSecret: process.env.NOTION_CLIENT_SECRET || "",
            }
        })
    ],
});

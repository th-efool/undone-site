import "dotenv/config";

import { createCorsair } from "corsair";
import { github } from "@corsair-dev/github";
import { notion } from "@corsair-dev/notion";
import { Pool } from "pg";
import { readCorsairConfig } from './corsair-config';

const config = readCorsairConfig();
const pool = new Pool({ connectionString: config.connectionString });

export const corsair = createCorsair({
    kek: config.kek,
    database: pool,
    hub: config.hub,
    plugins: [
        github({ authType: 'managed' }),
        notion({ authType: 'managed' })
    ],
});

import "dotenv/config";

import { createCorsair } from "corsair";
import { github } from "@corsair-dev/github";
import { notion } from "@corsair-dev/notion";
import { Pool } from "pg";
import { readCorsairConfig } from './corsair-config';

function createRuntime() {
    const config = readCorsairConfig();
    const pool = new Pool({ connectionString: config.connectionString });
    return createCorsair({
        kek: config.kek,
        database: pool,
        hub: config.hub,
        plugins: [
            github({ authType: 'managed' }),
            notion({ authType: 'managed' })
        ],
    });
}

let singleton: ReturnType<typeof createRuntime> | undefined;
/** Configuration and Hub side effects belong to actual requests, never module discovery. */
export function getCorsair() { return singleton ??= createRuntime(); }

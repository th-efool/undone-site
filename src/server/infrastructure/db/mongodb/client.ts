import mongoose, { ConnectOptions } from 'mongoose';

// 1. Get the connection string from environment variables
const getMongoUri = () => process.env.MONGODB_URI;

// 2. Define the shape of our global mongoose cache
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// 3. Attach the cache to the global object.
// In TypeScript, we have to extend the NodeJS.Global interface slightly
declare global {
  var mongooseCache: MongooseCache;
}

// Initialize the cache if it doesn't exist (first run)
let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Returns connection options configured for MongoDB Atlas connection hygiene
 * and serverless execution environments (Vercel, AWS Lambda, production).
 */
export function getMongoConnectionOptions(): ConnectOptions {
  const isServerless =
    process.env.VERCEL === '1' ||
    process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined ||
    process.env.NODE_ENV === 'production';

  const maxPoolSize =
    Number(process.env.MONGODB_MAX_POOL_SIZE) || (isServerless ? 2 : 10);

  return {
    maxPoolSize,
    minPoolSize: 0,
    maxIdleTimeMS: 10000,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    bufferCommands: false,
  };
}

export async function connectToMongoDB() {
  if (!global.mongooseCache) {
    global.mongooseCache = { conn: null, promise: null };
  }
  cached = global.mongooseCache;

  // 4. If we already have a connection, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // 5. If we don't have a promise currently resolving, create one
  if (!cached.promise) {
    const uri = getMongoUri();
    if (!uri) {
      throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
    }

    const opts = getMongoConnectionOptions();

    cached.promise = mongoose.connect(uri, opts).then((mongooseInstance) => {
      console.log('✅ Connected to MongoDB via Mongoose');
      return mongooseInstance;
    });
  }

  try {
    // 6. Await the promise and store the actual connection
    cached.conn = await cached.promise;
  } catch (e) {
    // If it fails, clear the promise so we can try again next time
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

import mongoose from 'mongoose';

// 1. Get the connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

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

export async function connectToMongoDB() {
  // 4. If we already have a connection, return it immediately
  if (cached.conn) {
    return cached.conn;
  }

  // 5. If we don't have a promise currently resolving, create one
  if (!cached.promise) {
    const opts = {
      // bufferCommands: false means Mongoose will throw an error immediately 
      // if you try to query before the connection is established, 
      // rather than queuing the query indefinitely.
      bufferCommands: false, 
    };

    cached.promise = mongoose.connect(MONGODB_URI as string, opts).then((mongoose) => {
      console.log('✅ Connected to MongoDB via Mongoose');
      return mongoose;
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

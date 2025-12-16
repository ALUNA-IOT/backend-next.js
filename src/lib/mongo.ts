import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URL ?? process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "aluna_iot";

if (!uri) {
  console.warn(
    "[mongo] MONGODB_URL/MONGODB_URI is not set; Mongo client will be unavailable",
  );
}

const globalForMongo = globalThis as unknown as {
  mongoClient?: MongoClient;
};

export const getMongoClient = async (): Promise<MongoClient> => {
  if (!uri) {
    throw new Error("MONGODB_URL (or MONGODB_URI) env var is required");
  }
  if (!globalForMongo.mongoClient) {
    globalForMongo.mongoClient = new MongoClient(uri, {
      retryWrites: true,
    });
  }
  if (!globalForMongo.mongoClient.topology?.isConnected()) {
    await globalForMongo.mongoClient.connect();
  }
  return globalForMongo.mongoClient;
};

export const getMongoDb = async () => {
  const client = await getMongoClient();
  return client.db(dbName);
};

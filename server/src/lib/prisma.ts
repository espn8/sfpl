import { PrismaClient, type Prisma } from "@prisma/client";
import { getPerfContext, isPerfLogEnabled } from "../middleware/requestTiming";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const perfLog = isPerfLogEnabled();

  if (perfLog) {
    const client = new PrismaClient({
      log: [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
      ],
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    (client as unknown as { $on: (event: "query", cb: (e: Prisma.QueryEvent) => void) => void }).$on(
      "query",
      (event) => {
        const ctx = getPerfContext();
        const reqId = ctx?.requestId ?? "-";
        const query = event.query.length > 240 ? `${event.query.slice(0, 240)}...` : event.query;
        // eslint-disable-next-line no-console
        console.log(`[prisma] req=${reqId} duration=${event.duration}ms ${query}`);
      },
    );

    return client;
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

export const prisma = global.__prisma ?? createPrismaClient();

global.__prisma = prisma;

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import { PrismaClient } from "@prisma/client";

dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be defined in environment variables.");
}

const app = express();
const prisma = new PrismaClient();

const allowedOrigin = "https://aosfpl-a2e28a52e18c.herokuapp.com";
const port = Number(process.env.PORT || 5000);

app.use(
  cors({
    origin: allowedOrigin,
  }),
);
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (_error) {
    res.status(500).json({ ok: false });
  }
});

const publicPath = path.resolve(__dirname, "../public");
app.use(express.static(publicPath));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

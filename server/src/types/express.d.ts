import { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      apiKeyAuth?: {
        userId: number;
        teamId: number;
        role: Role;
        userOu: string | null;
        apiKeyId: number;
      };
    }
  }
}

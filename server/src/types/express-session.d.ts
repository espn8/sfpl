import "express-session";
import { Role } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    auth?: {
      userId: number;
      teamId: number;
      role: Role;
      userOu: string | null;
    };
    oauth?: {
      state: string;
      nonce: string;
    };
  }
}

import "express-session";
import { Role } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    auth?: {
      userId: number;
      teamId: number;
      role: Role;
    };
    oauth?: {
      state: string;
      nonce: string;
    };
  }
}

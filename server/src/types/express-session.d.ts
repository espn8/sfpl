import "express-session";
import { Role } from "@prisma/client";

declare module "express-session" {
  interface SessionData {
    auth?: {
      userId: number;
      teamId: number;
      role: Role;
      userOu: string | null;
      onboardingCompleted: boolean;
    };
    /** Set after profile-gate archive runs for this session (user had incomplete onboarding). */
    profileGateArchiveDone?: boolean;
    oauth?: {
      state: string;
      nonce: string;
    };
  }
}

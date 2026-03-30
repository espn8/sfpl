import type { Request, Response } from "express";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";

const authRouter = Router();
const googleIssuer = "https://accounts.google.com";
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function exchangeCodeForIdToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: env.googleClientId,
    client_secret: env.googleClientSecret,
    redirect_uri: env.googleCallbackUrl,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  const tokenResult = (await response.json()) as { id_token?: string };
  if (!tokenResult.id_token) {
    throw new Error("Google token response missing id_token.");
  }

  return tokenResult.id_token;
}

authRouter.get("/google", (req: Request, res: Response) => {
  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  req.session.oauth = { state, nonce };

  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: env.googleCallbackUrl,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    state,
    nonce,
  });

  req.session.save((err) => {
    if (err) {
      return res.status(500).json({
        error: {
          code: "SESSION_SAVE_FAILED",
          message: "Failed to save session state.",
        },
      });
    }
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });
});

authRouter.get("/google/start", (req: Request, res: Response) => {
  res.redirect("/api/auth/google");
});

authRouter.get("/google/callback", async (req: Request, res: Response) => {
  try {
    const code = req.query.code;
    const state = req.query.state;
    if (typeof code !== "string" || typeof state !== "string") {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid OAuth callback parameters." } });
    }

    if (!req.session.oauth || req.session.oauth.state !== state) {
      return res.status(400).json({ error: { code: "INVALID_STATE", message: "OAuth state validation failed." } });
    }

    const idToken = await exchangeCodeForIdToken(code);
    const verifiedToken = await jwtVerify(idToken, googleJwks, {
      issuer: googleIssuer,
      audience: env.googleClientId,
    });
    const claims = verifiedToken.payload;

    if (claims.nonce !== req.session.oauth.nonce) {
      return res.status(400).json({ error: { code: "INVALID_NONCE", message: "OAuth nonce validation failed." } });
    }

    if (claims.email_verified !== true || typeof claims.email !== "string") {
      return res.status(403).json({ error: { code: "UNVERIFIED_EMAIL", message: "Google email must be verified." } });
    }

    if (typeof claims.sub !== "string") {
      return res.status(403).json({ error: { code: "INVALID_SUBJECT", message: "Google identity subject was missing." } });
    }

    const emailDomain = claims.email.split("@")[1] ?? "";
    if (env.googleAllowedDomain && emailDomain !== env.googleAllowedDomain) {
      return res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Email domain is not allowed." } });
    }

    const baseTeamSlug = toSlug(emailDomain || "default-team");
    const team = await prisma.team.upsert({
      where: { slug: baseTeamSlug },
      update: {},
      create: {
        slug: baseTeamSlug,
        name: emailDomain || "Default Team",
      },
    });

    const normalizedEmail = claims.email.toLowerCase();
    const existingByGoogle = await prisma.user.findUnique({ where: { googleSub: claims.sub } });
    const existingByEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    const user = existingByGoogle
      ? await prisma.user.update({
          where: { id: existingByGoogle.id },
          data: {
            email: normalizedEmail,
            name: typeof claims.name === "string" ? claims.name : null,
            avatarUrl: typeof claims.picture === "string" ? claims.picture : null,
            teamId: team.id,
          },
        })
      : existingByEmail
        ? await prisma.user.update({
            where: { id: existingByEmail.id },
            data: {
              googleSub: claims.sub,
              name: typeof claims.name === "string" ? claims.name : existingByEmail.name,
              avatarUrl: typeof claims.picture === "string" ? claims.picture : existingByEmail.avatarUrl,
              teamId: team.id,
            },
          })
        : await prisma.user.create({
            data: {
              email: normalizedEmail,
              googleSub: claims.sub,
              name: typeof claims.name === "string" ? claims.name : null,
              avatarUrl: typeof claims.picture === "string" ? claims.picture : null,
              role: "MEMBER",
              teamId: team.id,
            },
          });

    req.session.auth = {
      userId: user.id,
      teamId: user.teamId,
      role: user.role,
    };
    delete req.session.oauth;

    req.session.save((err) => {
      if (err) {
        return res.status(500).json({
          error: {
            code: "SESSION_SAVE_FAILED",
            message: "Failed to save authentication session.",
          },
        });
      }
      return res.redirect(env.appBaseUrl);
    });
  } catch (_error) {
    return res.status(500).json({
      error: {
        code: "GOOGLE_AUTH_FAILED",
        message: "Google authentication failed.",
      },
    });
  }
});

authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie("promptlibrary.sid");
    res.status(200).json({ data: { ok: true } });
  });
});

authRouter.get("/me", async (req: Request, res: Response) => {
  if (!req.session.auth) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Not authenticated.",
      },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.session.auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      teamId: true,
    },
  });

  if (!user) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Session user no longer exists.",
      },
    });
  }

  return res.status(200).json({ data: user });
});

export { authRouter };

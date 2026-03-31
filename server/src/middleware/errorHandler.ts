import type { NextFunction, Request, Response } from "express";

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error("Error:", error);

  const response: ErrorResponse = {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: error.message || "An unexpected error occurred.",
    },
  };

  if (process.env.NODE_ENV === "development") {
    response.error.details = error.stack;
  }

  res.status(500).json(response);
}

import type { Request, Response } from "express";
import { randomUUID } from "crypto";
import { csrfCookieOptions } from "../lib/tokens.js";

export const getCsrfToken = (_req: Request, res: Response): void => {
  const token = randomUUID();
  res.cookie("csrfToken", token, csrfCookieOptions());
  res.status(200).json({ _status: true, csrfToken: token });
};

import type { Request, Response } from "express";
import { sendEmail } from "../../lib/nodemailer.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { success, fail } from "../../utils/responses.js";

export const contact = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, email, message } = req.body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!name || !email || !message) {
      return fail(res, "All fields are required", 400);
    }

    if (env.MY_GMAIL) {
      sendEmail(env.MY_GMAIL, "contactEmail", {
        name,
        email,
        message,
        subject: `New Contact Form Submission from ${name}`,
        replyTo: email,
      }).catch((emailError) => {
        logger.error({ err: emailError }, "Failed to send contact email");
      });
    }

    return success(
      res,
      null,
      "Thank you for contacting us! We will get back to you soon.",
    );
  } catch (error) {
    logger.error({ err: error }, "Contact form error");
    return fail(
      res,
      "An error occurred while processing your request",
      500,
      error instanceof Error ? error.message : error,
    );
  }
};
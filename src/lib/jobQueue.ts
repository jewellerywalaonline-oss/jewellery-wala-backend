import JobModel from "../models/job.js";
import User from "../models/user.js";
import Product from "../models/product.js";
import Review from "../models/review.js";
import { sendEmail } from "./nodemailer.js";
import { logger } from "./logger.js";

// ── Job type definitions ──────────────────────────────────────────────

export type JobType = "send-email" | "update-profile" | "update-rating";

interface SendEmailPayload {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

interface UpdateProfilePayload {
  userId: string;
  updates: Record<string, unknown>;
}

interface UpdateRatingPayload {
  productId: string;
}

type JobPayload = SendEmailPayload | UpdateProfilePayload | UpdateRatingPayload;

// ── Handler registry ──────────────────────────────────────────────────

const handlers: Record<JobType, (payload: JobPayload) => Promise<void>> = {
  "send-email": async (payload) => {
    const { to, template, data } = payload as SendEmailPayload;
    const result = await sendEmail(to, template, data);
    if (!result) {
      throw new Error(`Failed to send email: ${template} to ${to}`);
    }
  },

  "update-profile": async (payload) => {
    const { userId, updates } = payload as UpdateProfilePayload;
    if (updates && typeof updates === "object" && Object.keys(updates).length > 0) {
      await User.updateOne({ _id: userId }, { $set: updates });
    }
  },

  "update-rating": async (payload) => {
    const { productId } = payload as UpdateRatingPayload;
    const reviews = await Review.find({ productId, deletedAt: null });
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((a, b) => a + (b.rating ?? 0), 0) / reviews.length
        : 0;
    await Product.findByIdAndUpdate(productId, {
      $set: {
        rating: parseFloat(avgRating.toFixed(1)),
        reviewCount: reviews.length,
      },
    });
  },
};

// ── Processing state ──────────────────────────────────────────────────

let processing = false;

// ── Process next pending job ──────────────────────────────────────────

async function processNext(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    const job = await JobModel.findOneAndUpdate(
      { status: "pending" },
      { $set: { status: "processing" } },
      { sort: { createdAt: 1 }, new: true },
    );

    if (!job) {
      processing = false;
      return;
    }

    const handler = handlers[job.type as JobType];
    if (!handler) {
      logger.error({ jobId: job._id, type: job.type }, "Job queue: unknown job type");
      job.status = "failed";
      job.error = `Unknown job type: ${job.type}`;
      job.processedAt = new Date();
      await job.save();
      processing = false;
      scheduleNext();
      return;
    }

    try {
      await handler(job.payload as JobPayload);
      job.status = "completed";
      job.processedAt = new Date();
      await job.save();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      job.retries = (job.retries ?? 0) + 1;

      if (job.retries >= (job.maxRetries ?? 3)) {
        job.status = "failed";
        job.error = message;
        job.processedAt = new Date();
        logger.error({ jobId: job._id, type: job.type, retries: job.retries, error: message }, "Job queue: job failed after max retries");
      } else {
        job.status = "pending";
        job.error = message;
        logger.warn({ jobId: job._id, type: job.type, retries: job.retries, error: message }, "Job queue: job failed, will retry");
      }
      await job.save();
    }
  } catch (error) {
    logger.error({ err: error }, "Job queue: error in processNext");
  }

  processing = false;
  scheduleNext();
}

function scheduleNext(): void {
  setImmediate(processNext);
}

// ── Public API ────────────────────────────────────────────────────────

export function enqueue(type: JobType, payload: JobPayload): void {
  JobModel.create({ type, payload }).catch((err) => {
    logger.error({ err, type }, "Job queue: failed to persist job");
  });

  if (!processing) {
    setImmediate(processNext);
  }
}

// ── Startup recovery ──────────────────────────────────────────────────
// On server start, reset any jobs stuck in "processing" back to "pending"
// so they get retried. This handles jobs that were in-flight during a crash.

export async function recoverStuckJobs(): Promise<void> {
  try {
    const result = await JobModel.updateMany(
      { status: "processing" },
      { $set: { status: "pending", error: "Recovered after restart" } },
    );
    if (result.modifiedCount > 0) {
      logger.info({ count: result.modifiedCount }, "Job queue: recovered stuck jobs after restart");
    }

    // Also retry any pending jobs that might have been missed
    const pendingCount = await JobModel.countDocuments({ status: "pending" });
    if (pendingCount > 0) {
      logger.info({ count: pendingCount }, "Job queue: pending jobs found, starting processor");
      setImmediate(processNext);
    }
  } catch (error) {
    logger.error({ err: error }, "Job queue: failed to recover stuck jobs");
  }
}

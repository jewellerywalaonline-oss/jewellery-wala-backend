import mongoose from "mongoose";

/**
 * Transaction support helper.
 *
 * MongoDB **transactions require a replica set** (or Atlas). Local standalone
 * `mongod` instances cannot start transactions — attempting to do so throws
 * `Transaction numbers are only allowed on a replica set member or mongos`.
 *
 * These helpers detect the deployment type once at startup and expose a
 * wrapper that transparently skips transactions when they are unsupported,
 * so the API works on both local standalone MongoDB and production replica
 * sets / Atlas.
 */

let txSupported: boolean | null = null;

/** Detect once whether the connected MongoDB supports multi-document transactions. */
export async function isTransactionSupported(): Promise<boolean> {
  if (txSupported !== null) return txSupported;

  try {
    const db = mongoose.connection.db;
    if (!db) {
      txSupported = false;
      return txSupported;
    }
    const hello = await db.admin().command({ hello: 1 });
    // `setName` is only present on replica set / sharded members
    txSupported = Boolean(hello.setName);
  } catch {
    txSupported = false;
  }

  if (!txSupported) {
    console.warn(
      "[transactions] Standalone MongoDB detected — running WITHOUT transactions. " +
        "Cart/wishlist/order writes remain correct, but lose atomic multi-document guarantees.",
    );
  }

  return txSupported;
}

/**
 * Run `fn` inside a MongoDB transaction when the deployment supports it.
 * Falls back to a plain (non-transactional) execution on standalone MongoDB.
 *
 * `session` is `null` in the fallback path, which is safe to pass to
 * `.session()` / `save({ session })` in mongoose (null simply means "no session").
 */
export async function withOptionalTransaction<T>(
  fn: (session: mongoose.ClientSession | null) => Promise<T>,
): Promise<T> {
  const supported = await isTransactionSupported();

  if (!supported) {
    return fn(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

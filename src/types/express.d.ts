/**
 * Module augmentation to type Express's `req.user` and friends.
 * Each auth middleware/controller that attaches user data imports this file.
 */
import type { IUser } from "./models/user.js";

declare global {
  namespace Express {
    interface AuthenticatedRequest extends Request {
      user?: IUser | null;
    }

    interface Request {
      user?: IUser | null;
      file?: Express.Multer.File;
      files?:
        | { [fieldname: string]: Express.Multer.File[] }
        | Express.Multer.File[];
    }
  }
}

export {};
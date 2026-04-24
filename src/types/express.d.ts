import type { User } from "@prisma/client";

declare global {
  namespace Express {
    interface User extends Pick<User, "id" | "email" | "role" | "microsoftId"> {}
  }
}

export {};

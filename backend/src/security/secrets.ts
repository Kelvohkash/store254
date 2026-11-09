import { AppError } from "./error-handler";

export function requireSecret(value: string | undefined, name: string): string {
  if (!value) {
    throw new AppError(`${name} is not configured.`, 500, "SERVER_MISCONFIGURED");
  }

  return value;
}
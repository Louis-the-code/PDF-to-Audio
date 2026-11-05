import { ApiError } from "./api";

/** A user-facing message for any thrown value. Errors from our backend already carry one. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return "An unexpected error occurred during processing.";
}

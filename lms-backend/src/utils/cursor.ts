import { ValidationError } from "./globalErrorHandlingFile";

export function encodeCursor(payload: object): string {
  try {
    const jsonString = JSON.stringify(payload);
    return Buffer.from(jsonString).toString("base64url");
  } catch (error) {
    throw new ValidationError("Failed to encode cursor");
  }
}

export function decodeCursor<T>(cursor: string): T {
  try {
    const jsonString = Buffer.from(cursor, "base64url").toString("utf-8");
    return JSON.parse(jsonString) as T;
  } catch (error) {
    throw new ValidationError("Invalid cursor format");
  }
}

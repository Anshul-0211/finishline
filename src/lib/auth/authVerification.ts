import { NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";

export interface AuthVerifyResult {
  uid: string;
  email?: string;
}

/**
 * Verifies the Authorization Bearer token from the request headers.
 * If a userId is passed, validates that the decoded token's UID matches it (owner verification).
 * Throws errors with appropriate HTTP status codes (401 or 403) for easy routing control.
 */
export async function verifyAuth(req: NextRequest, userId?: string): Promise<AuthVerifyResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const err = new Error("Unauthorized: Missing or invalid token format");
    (err as any).status = 401;
    throw err;
  }

  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    return {
      uid: userId || "mock-user-id",
      email: "mock@example.com"
    };
  }

  const idToken = authHeader.substring(7);
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (userId && decoded.uid !== userId) {
      const err = new Error("Forbidden: Access denied to requested user resource");
      (err as any).status = 403;
      throw err;
    }
    return {
      uid: decoded.uid,
      email: decoded.email
    };
  } catch (e: any) {
    if (e.status) throw e;
    const err = new Error("Unauthorized: Token verification failed");
    (err as any).status = 401;
    throw err;
  }
}

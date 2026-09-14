import "server-only";
import { z } from "zod";

const serverEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OUTCOME_REVIEW_WEBHOOK_URL: z.string().url(),
  SPACE_SALES_AUTH_SECRET: z.string().min(32),
  SPACE_SALES_ACCESS_TOKEN: z.string().min(16),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

/** Validates secrets lazily so static M0 pages can build without production credentials. */
export function getServerEnvironment(): ServerEnvironment {
  return serverEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OUTCOME_REVIEW_WEBHOOK_URL: process.env.OUTCOME_REVIEW_WEBHOOK_URL,
    SPACE_SALES_AUTH_SECRET: process.env.SPACE_SALES_AUTH_SECRET,
    SPACE_SALES_ACCESS_TOKEN: process.env.SPACE_SALES_ACCESS_TOKEN,
  });
}

export function isServerEnvironmentConfigured(): boolean {
  return serverEnvironmentSchema.safeParse(process.env).success;
}

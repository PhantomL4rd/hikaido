declare global {
  type D1Database = import("@cloudflare/workers-types").D1Database;
  type ExecutionContext = import("@cloudflare/workers-types").ExecutionContext;
  namespace App {
    interface Locals {
      env: Env;
      waitUntil: (promise: Promise<unknown>) => void;
    }
  }
  type Fetcher = import("@cloudflare/workers-types").Fetcher;
  interface Env extends CloudflareBindings {
    SLACK_WEBHOOK_URL?: string;
    TURNSTILE_SECRET_KEY?: string;
  }
}

export {};

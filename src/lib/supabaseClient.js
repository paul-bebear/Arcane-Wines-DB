import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || "https://zvhkdwofojwpkyikbauo.supabase.co";
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2aGtkd29mb2p3cGt5aWtiYXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjc0NzEsImV4cCI6MjA5MDgwMzQ3MX0.gBwTtCLpnm0C9o8UVbFCqMQLc5x5bIokliP_hPpXurw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

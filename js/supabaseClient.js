import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

if (SUPABASE_URL.includes("YOUR-PROJECT-ref") || SUPABASE_ANON_KEY.includes("YOUR-ANON")) {
  // Не кидаємо помилку -- даємо UI показати зрозуміле повідомлення замість білого екрана.
  console.warn(
    "Supabase не налаштовано: відкрийте js/config.js і вставте SUPABASE_URL / SUPABASE_ANON_KEY " +
      "зі свого проєкту (Project Settings -> API)."
  );
}

export const isConfigured =
  !SUPABASE_URL.includes("YOUR-PROJECT-ref") && !SUPABASE_ANON_KEY.includes("YOUR-ANON");

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

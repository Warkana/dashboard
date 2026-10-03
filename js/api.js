import { supabase } from "./supabaseClient.js";

const TABLE = "tasks";

export async function fetchTasks() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("status", { ascending: true })
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTask(input) {
  const { data, error } = await supabase.from(TABLE).insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from(TABLE).update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Realtime-підписка на зміни таблиці tasks для поточного користувача.
 * onChange отримує { eventType, record, oldRecord }.
 * Повертає функцію відписки.
 */
export function subscribeToTasks(onChange) {
  const channel = supabase
    .channel("tasks-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: TABLE }, (payload) => {
      onChange({
        eventType: payload.eventType,
        record: payload.new,
        oldRecord: payload.old,
      });
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}

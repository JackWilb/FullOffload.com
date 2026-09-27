// The data-access module: the only place the app reads or writes Supabase. Components use these
// hooks, so caching or static snapshots can be swapped in here later without touching them.
import type { PostgrestError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesInsert } from "./database.types";
import type { Device, DeviceAlias } from "./devices";
import { supabase } from "./supabase";

// ---------------------------------------------------------------------------------------------
// Devices

export type DeviceList = { devices: Device[]; aliases: DeviceAlias[] };

async function fetchDeviceList(): Promise<DeviceList> {
  const [devices, aliases] = await Promise.all([
    supabase.from("devices").select("*").order("name"),
    supabase.from("device_aliases").select("*"),
  ]);
  if (devices.error) throw devices.error;
  if (aliases.error) throw aliases.error;
  return { devices: devices.data, aliases: aliases.data };
}

export function useDeviceList() {
  return useQuery({
    queryKey: ["devices"],
    queryFn: fetchDeviceList,
    staleTime: 5 * 60_000,
  });
}

/** Thrown when a new device's name already exists (by name or alias). Refetch and reuse it. */
export class DeviceExistsError extends Error {}

export function useAddDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string): Promise<Device> => {
      const { data, error } = await supabase
        .from("devices")
        .insert({ name })
        .select()
        .single();
      if (error?.code === "23505") throw new DeviceExistsError(error.message);
      if (error) throw error;
      return data;
    },
    onSuccess: (device) =>
      // Add it right away so the form can select it before the refetch lands.
      queryClient.setQueryData<DeviceList>(["devices"], (list) =>
        list ? { ...list, devices: [...list.devices, device] } : list,
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["devices"] }),
  });
}

// ---------------------------------------------------------------------------------------------
// Results

export type Submission = Pick<
  Tables<"submissions">,
  | "id"
  | "user_id"
  | "device_count"
  | "raw_command"
  | "runtime"
  | "model"
  | "quant"
  | "context_size"
  | "gen_tok_s"
  | "prompt_tok_s"
  | "created_at"
>;

/** One row of results_by_device, with the submissions (and commands) behind it. */
export type Result = {
  key: string;
  deviceCount: number;
  runtime: string;
  model: string;
  quant: string | null;
  medianGenTokS: number;
  medianPromptTokS: number;
  typicalContextSize: number | null;
  submissionCount: number;
  submissions: Submission[];
};

const SUBMISSION_COLUMNS =
  "id, user_id, device_count, raw_command, runtime, model, quant, context_size, gen_tok_s, prompt_tok_s, created_at";

function resultKey(row: {
  device_count: number | null;
  runtime: string | null;
  model: string | null;
  quant: string | null;
}): string {
  return JSON.stringify([row.device_count, row.runtime, row.model, row.quant]);
}

async function fetchDeviceResults(deviceId: number): Promise<Result[]> {
  const [results, submissions] = await Promise.all([
    supabase.from("results_by_device").select("*").eq("device_id", deviceId),
    supabase
      .from("submissions")
      .select(SUBMISSION_COLUMNS)
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false }),
  ]);
  if (results.error) throw results.error;
  if (submissions.error) throw submissions.error;

  const byKey = new Map<string, Submission[]>();
  for (const submission of submissions.data) {
    const key = resultKey(submission);
    byKey.set(key, [...(byKey.get(key) ?? []), submission]);
  }

  return results.data.map((row) => {
    const key = resultKey(row);
    return {
      key,
      deviceCount: row.device_count ?? 1,
      runtime: row.runtime ?? "",
      model: row.model ?? "",
      quant: row.quant,
      medianGenTokS: row.median_gen_tok_s ?? 0,
      medianPromptTokS: row.median_prompt_tok_s ?? 0,
      typicalContextSize: row.typical_context_size,
      submissionCount: row.submission_count ?? 0,
      submissions: byKey.get(key) ?? [],
    };
  });
}

export function useDeviceResults(deviceId: number | undefined) {
  return useQuery({
    queryKey: ["results", deviceId],
    queryFn: () => fetchDeviceResults(deviceId ?? 0),
    enabled: deviceId !== undefined,
  });
}

export type LatestSubmission = Submission & {
  device: Pick<Device, "name" | "normalized_name"> | null;
};

async function fetchLatestSubmission(): Promise<LatestSubmission | null> {
  const { data, error } = await supabase
    .from("submissions")
    .select(
      `${SUBMISSION_COLUMNS}, device:devices(name, normalized_name)` as const,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function useLatestSubmission() {
  return useQuery({
    queryKey: ["latest-submission"],
    queryFn: fetchLatestSubmission,
  });
}

// ---------------------------------------------------------------------------------------------
// Submitting and deleting

export type NewSubmission = Omit<TablesInsert<"submissions">, "user_id">;

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submission: NewSubmission) => {
      const { error } = await supabase.from("submissions").insert(submission);
      if (error) throw error;
    },
    onSuccess: (_data, submission) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["results", submission.device_id],
        }),
        queryClient.invalidateQueries({ queryKey: ["latest-submission"] }),
      ]),
  });
}

export function useDeleteSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submissionId: number) => {
      const { error, count } = await supabase
        .from("submissions")
        .delete({ count: "exact" })
        .eq("id", submissionId);
      if (error) throw error;
      // RLS turns a delete of someone else's row into zero rows, not an error.
      if (count === 0) throw new Error("You can only delete your own results.");
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["results"] }),
        queryClient.invalidateQueries({ queryKey: ["latest-submission"] }),
      ]),
  });
}

/**
 * Deletes the signed-in user's account and every result they submitted, then clears the local
 * session (the server-side user no longer exists).
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("delete_own_account");
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" });
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/** A readable message for a failed Supabase call. */
export function errorMessage(error: unknown): string {
  const postgrest = error as Partial<PostgrestError> | null;
  // The rate-limit trigger's message is written for people.
  if (postgrest?.code === "PT429" && postgrest.message)
    return postgrest.message;
  if (postgrest?.code === "23514")
    return "One of the values is out of range. Check the form and try again.";
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Try again.";
}

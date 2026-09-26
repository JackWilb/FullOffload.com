import { Code, Stack, Text } from "@mantine/core";

const HINTS = [
  {
    runtime: "llama.cpp",
    command: "llama-bench",
    text: "prints prompt (pp) and generation (tg) tok/s.",
  },
  {
    runtime: "Ollama",
    command: "ollama run --verbose",
    text: "prints prompt eval rate and eval rate.",
  },
  {
    runtime: "vLLM",
    command: null,
    text: "The server log prints average prompt and generation throughput.",
  },
  {
    runtime: "MLX",
    command: "mlx_lm.generate",
    text: "prints prompt and generation tokens-per-sec.",
  },
  {
    runtime: "LM Studio",
    command: null,
    text: "Shows tok/s under each reply.",
  },
] as const;

/** Where each runtime prints the two speeds the submit form asks for. */
export function SpeedHints({ compact = false }: { compact?: boolean }) {
  const hints = compact
    ? HINTS.filter((hint) => hint.runtime !== "vLLM" && hint.runtime !== "MLX")
    : HINTS;
  return (
    <Stack gap="sm">
      {hints.map((hint) => (
        <div key={hint.runtime}>
          <Text size="sm" fw={600}>
            {hint.runtime}
          </Text>
          <Text size="sm" c="dimmed">
            {hint.command && <Code>{hint.command}</Code>} {hint.text}
          </Text>
        </div>
      ))}
    </Stack>
  );
}

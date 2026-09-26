// Command parser: turns the command someone ran into canonical runtime, model, quant and context
// size strings, so equivalent submissions group into one result row. Pure and synchronous: no
// network calls. Every field is null when it can't be determined; the submit form lets people fix
// anything. The fixtures in fixtures/commands/ are the spec.

export type ParsedCommand = {
  runtime: string | null;
  model: string | null;
  quant: string | null;
  contextSize: number | null;
};

const EMPTY: ParsedCommand = {
  runtime: null,
  model: null,
  quant: null,
  contextSize: null,
};

const MAX_CONTEXT_SIZE = 10_000_000;

export function parseCommand(input: string): ParsedCommand {
  for (const segment of splitSegments(tokenize(input))) {
    const parsed = parseSegment(segment);
    if (parsed) return parsed;
  }
  return EMPTY;
}

// ---------------------------------------------------------------------------------------------
// Tokenizing

const SEPARATOR = Symbol("separator");
type Token = string | typeof SEPARATOR;

/**
 * Shell-like tokenizer. Handles quotes and line continuations, and marks `&&`, `||`, `;`, `|` and
 * newlines as command separators. Backslashes outside quotes stay literal so Windows paths
 * survive.
 */
function tokenize(input: string): Token[] {
  const text = input.replace(/\\\r?\n/g, " ");
  const tokens: Token[] = [];
  let current = "";
  let inToken = false;
  let quote: '"' | "'" | null = null;

  const flush = () => {
    if (inToken) tokens.push(current);
    current = "";
    inToken = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (
        quote === '"' &&
        char === "\\" &&
        /["\\$`]/.test(text.charAt(i + 1))
      ) {
        current += text.charAt(++i);
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
      inToken = true;
    } else if (/\s/.test(char) && char !== "\n") {
      flush();
    } else if (char === "\n" || char === ";" || char === "|" || char === "&") {
      flush();
      tokens.push(SEPARATOR);
    } else {
      current += char;
      inToken = true;
    }
  }
  flush();
  return tokens;
}

function splitSegments(tokens: Token[]): string[][] {
  const segments: string[][] = [[]];
  for (const token of tokens) {
    if (token === SEPARATOR) segments.push([]);
    else segments[segments.length - 1]?.push(token);
  }
  return segments.filter((segment) => segment.length > 0);
}

// ---------------------------------------------------------------------------------------------
// Runtimes

const PREFIX_COMMANDS = new Set(["sudo", "time", "nohup", "env", "exec"]);
const LLAMA_CPP_BINARIES = new Set([
  "llama-server",
  "llama-cli",
  "llama-bench",
]);

function parseSegment(segment: string[]): ParsedCommand | null {
  const env = new Map<string, string>();
  let i = 0;
  for (; i < segment.length; i++) {
    const token = segment[i] ?? "";
    const assignment = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(token);
    if (assignment) env.set(assignment[1] ?? "", assignment[2] ?? "");
    else if (!PREFIX_COMMANDS.has(token)) break;
  }

  const command = commandName(segment[i] ?? "");
  let args = segment.slice(i + 1);

  if (LLAMA_CPP_BINARIES.has(command)) return parseLlamaCpp(args);
  if (command === "ollama") return parseOllama(args, env);
  if (command === "vllm") return parseVllm(args);
  if (command.startsWith("mlx_lm")) return parseMlx(args);
  if (command === "lms") return parseLmStudio(args);

  if (/^python(\d(\.\d+)?)?$/.test(command) && args[0] === "-m") {
    const module = (args[1] ?? "").toLowerCase();
    args = args.slice(2);
    if (module.startsWith("vllm")) return parseVllm(args);
    if (module.startsWith("mlx_lm")) return parseMlx(args);
  }
  return null;
}

/** "./build/bin/llama-server.exe" -> "llama-server" */
function commandName(token: string): string {
  return basename(token)
    .toLowerCase()
    .replace(/\.exe$/, "");
}

function parseLlamaCpp(args: string[]): ParsedCommand {
  const file = flagValue(args, ["--hf-file", "-hff"]);
  const repo = flagValue(args, ["-hf", "--hf-repo", "-hfr"]);
  const path = flagValue(args, ["-m", "--model"]);
  const name = file ?? path ?? repo;
  return {
    runtime: "llama.cpp",
    ...modelAndQuant(name),
    contextSize: parseContextSize(flagValue(args, ["-c", "--ctx-size"])),
  };
}

function parseOllama(args: string[], env: Map<string, string>): ParsedCommand {
  const name =
    args[0]?.toLowerCase() === "run" ? positional(args.slice(1)) : null;
  return {
    runtime: "ollama",
    ...modelAndQuant(name, { ollamaTag: true }),
    contextSize: parseContextSize(env.get("OLLAMA_CONTEXT_LENGTH") ?? null),
  };
}

function parseVllm(args: string[]): ParsedCommand {
  const name =
    flagValue(args, ["--model"]) ??
    (args[0] === "serve" ? positional(args.slice(1)) : null);
  const parsed = modelAndQuant(name);
  const quantization = flagValue(args, ["--quantization", "-q"]);
  return {
    runtime: "vllm",
    model: parsed.model,
    quant: parsed.quant ?? (quantization ? canonicalQuant(quantization) : null),
    contextSize: parseContextSize(flagValue(args, ["--max-model-len"])),
  };
}

function parseMlx(args: string[]): ParsedCommand {
  // mlx_lm's -m is --max-tokens, so only --model names the model.
  return {
    runtime: "mlx",
    ...modelAndQuant(flagValue(args, ["--model"])),
    contextSize: null,
  };
}

function parseLmStudio(args: string[]): ParsedCommand {
  const subcommand = args[0]?.toLowerCase();
  const name =
    subcommand === "load" || subcommand === "chat"
      ? positional(args.slice(1))
      : null;
  return {
    runtime: "lm-studio",
    ...modelAndQuant(name),
    contextSize: parseContextSize(flagValue(args, ["--context-length"])),
  };
}

// ---------------------------------------------------------------------------------------------
// Flags

/** The value of the first matching flag, as `-c 8192` or `--ctx-size=8192`. */
function flagValue(args: string[], flags: string[]): string | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? "";
    for (const flag of flags) {
      if (arg === flag) {
        const value = args[i + 1];
        return value !== undefined && !value.startsWith("-") ? value : null;
      }
      if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1) || null;
    }
  }
  return null;
}

function positional(args: string[]): string | null {
  return args.find((arg) => !arg.startsWith("-")) ?? null;
}

const CONTEXT_MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  K: 1_024,
  m: 1_000_000,
  M: 1_048_576,
};

/**
 * Context sizes are integers; vLLM-style suffixes are accepted (k = 1,000, K = 1,024,
 * m = 1,000,000, M = 1,048,576). Out-of-range values (including llama.cpp's "0 = from model")
 * are null.
 */
function parseContextSize(value: string | null): number | null {
  const match = value ? /^(\d+(?:\.\d+)?)([kKmM]?)$/.exec(value.trim()) : null;
  if (!match) return null;
  const multiplier = CONTEXT_MULTIPLIERS[match[2] ?? ""] ?? 1;
  const size = Math.round(Number(match[1]) * multiplier);
  return size >= 1 && size <= MAX_CONTEXT_SIZE ? size : null;
}

// ---------------------------------------------------------------------------------------------
// Model and quant names

// GGUF quants: a head like q4 / iq4 / tq1 followed by parts like k, m, 0, xs ("q4_k_m", "iq4_xs").
const GGUF_QUANT_HEAD = /^(i?q\d+|tq\d+)$/;
const GGUF_QUANT_PARTS = new Set([
  "k",
  "0",
  "1",
  "xxs",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "nl",
]);
// "q4km" without separators.
const COMPACT_K_QUANT = /^(i?q\d+)(k)(xxs|xs|xl|s|m|l)?$/;
// Whole-word quant and precision tags used by vLLM, MLX and GGUF.
const QUANT_WORDS =
  /^(f16|bf16|f32|fp16|fp32|fp8|fp4|mxfp4|nvfp4|awq|gptq|int4|int8|w4a16|w8a8|w8a16|dwq|exl2|\d+bit|\d+(\.\d+)?bpw)$/;
// Packaging tags that are neither model nor quant.
const FORMAT_WORDS = new Set(["gguf", "ggml", "mlx"]);

/** Lowercase, with separators as underscores: "Q4_K_M", "q4-k-m" and "q4km" become "q4_k_m". */
export function canonicalQuant(raw: string): string | null {
  const quant = raw.trim().toLowerCase().replace(/-/g, "_");
  const compact = COMPACT_K_QUANT.exec(quant);
  if (compact)
    return [compact[1], compact[2], compact[3]].filter(Boolean).join("_");
  return quant || null;
}

type Piece = { separator: string; word: string };

/**
 * Splits a model reference (file path, Hugging Face repo, Ollama tag) into a canonical model name
 * and quant: "unsloth/Qwen3-30B-A3B-GGUF:Q4_K_M" -> { model: "qwen3-30b-a3b", quant: "q4_k_m" }.
 */
function modelAndQuant(
  reference: string | null,
  options: { ollamaTag?: boolean } = {},
): { model: string | null; quant: string | null } {
  if (!reference) return { model: null, quant: null };

  let name = reference
    .trim()
    .replace(/^(https?:\/\/)?(hf\.co|huggingface\.co)\//i, "");
  let explicitQuant: string | null = null;

  // A colon after the last path separator starts a tag; in "C:\models\x.gguf" it is a drive letter.
  const colon = name.lastIndexOf(":");
  if (
    colon > 0 &&
    colon > Math.max(name.lastIndexOf("/"), name.lastIndexOf("\\"))
  ) {
    const tag = name.slice(colon + 1);
    name = name.slice(0, colon);
    // A Hugging Face repo's tag is a quant; an Ollama tag is part of the model ("llama3.1:8b").
    if (options.ollamaTag && !/\//.test(name)) {
      if (tag.toLowerCase() !== "latest") name = `${name}-${tag}`;
    } else {
      explicitQuant = tag;
    }
  }

  name = basename(name)
    .toLowerCase()
    .replace(/\.(gguf|bin|safetensors)$/, "")
    .replace(/-\d{5}-of-\d{5}$/, "");

  const pieces: Piece[] = [...name.matchAll(/([-_.]?)([^-_.]+)/g)].map(
    (match) => ({
      separator: match[1] ?? "",
      word: match[2] ?? "",
    }),
  );
  const quantParts: string[] = [];

  // Peel quant and format tags off the end, keeping at least one word of model name.
  for (let changed = true; changed && pieces.length > 1;) {
    changed = false;
    const last = pieces[pieces.length - 1]?.word ?? "";

    if (FORMAT_WORDS.has(last)) {
      pieces.pop();
      changed = true;
      continue;
    }
    if (QUANT_WORDS.test(last) || COMPACT_K_QUANT.test(last)) {
      quantParts.unshift(last);
      pieces.pop();
      changed = true;
      continue;
    }

    let head = pieces.length - 1;
    while (head > 0 && GGUF_QUANT_PARTS.has(pieces[head]?.word ?? "")) head--;
    if (head > 0 && GGUF_QUANT_HEAD.test(pieces[head]?.word ?? "")) {
      if (head > 1 && pieces[head - 1]?.word === "ud") head--; // Unsloth dynamic quants
      quantParts.unshift(
        pieces
          .splice(head)
          .map((piece) => piece.word)
          .join("_"),
      );
      changed = true;
    }
  }

  const model = pieces
    .map((piece) => piece.separator + piece.word)
    .join("")
    .replace(/^[-_.]+/, "");
  const quant =
    explicitQuant ?? (quantParts.length > 0 ? quantParts.join("_") : null);

  return {
    model: model || null,
    quant: quant ? canonicalQuant(quant) : null,
  };
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? "";
}

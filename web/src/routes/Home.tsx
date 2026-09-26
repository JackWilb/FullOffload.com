import {
  Anchor,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconBolt,
  IconCpu,
  IconStack2,
  IconTerminal2,
} from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { DevicePicker } from "../components/DevicePicker";
import { useDeviceList, useLatestSubmission } from "../lib/api";
import { deviceSlug, findExactDevice } from "../lib/devices";
import { deviceCountLabel, formatContext, formatSpeed } from "../lib/format";

const POPULAR = ["RTX 4090", "RTX 3090", "M3 Max", "M4 Max", "RX 7900 XTX"];

const FEATURES = [
  {
    icon: IconBolt,
    title: "Real measurements",
    text: "Speeds people measured on their own machines, not estimates.",
  },
  {
    icon: IconCpu,
    title: "Any runtime",
    text: "llama.cpp, Ollama, vLLM, MLX, LM Studio and more.",
  },
  {
    icon: IconStack2,
    title: "Multi-GPU rigs",
    text: "Each result records how many cards ran it.",
  },
  {
    icon: IconTerminal2,
    title: "Exact commands",
    text: "Copy the command behind any number and reproduce it yourself.",
  },
];

export function Home() {
  const navigate = useNavigate();
  const deviceList = useDeviceList();
  const [search, setSearch] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const devices = deviceList.data?.devices ?? [];
  const aliases = deviceList.data?.aliases ?? [];

  const pickPopular = (name: string) => {
    const device = findExactDevice(devices, aliases, name);
    if (device) {
      void navigate(`/device/${deviceSlug(device)}`);
    } else {
      // A family like "M3 Max": show every memory variant to choose from.
      setSearch(name);
      searchInput.current?.focus();
    }
  };

  return (
    <Stack gap={48}>
      <title>Full Offload</title>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48} verticalSpacing="xl">
        <Stack gap="lg" justify="center">
          <Badge variant="dot" size="lg" tt="none" visibleFrom="sm">
            Crowdsourced local LLM speeds
          </Badge>
          <Title order={1} fz={{ base: 34, sm: 48 }} lh={1.1}>
            See which models hit full offload on your hardware.
          </Title>
          <Text size="lg" c="dimmed">
            Real tokens-per-second numbers from people running llama.cpp,
            Ollama, vLLM, MLX and LM Studio at home. Every result shows the
            exact command behind it.
          </Text>
          <DevicePicker
            ref={searchInput}
            size="lg"
            placeholder="Search your GPU or Mac"
            aria-label="Search your GPU or Mac"
            devices={devices}
            aliases={aliases}
            search={search}
            onSearchChange={setSearch}
            onDeviceSelect={(device) =>
              void navigate(`/device/${deviceSlug(device)}`)
            }
            disabled={deviceList.isPending}
            error={
              deviceList.isError
                ? "Couldn't load the device list. Refresh to try again."
                : undefined
            }
          />
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              Popular
            </Text>
            {POPULAR.map((name) => (
              <Button
                key={name}
                variant="default"
                size="compact-sm"
                radius="xl"
                onClick={() => pickPopular(name)}
              >
                {name}
              </Button>
            ))}
          </Group>
        </Stack>
        <Stack justify="center">
          <LatestResult />
        </Stack>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="xl" verticalSpacing="xl">
        {FEATURES.map((feature) => (
          <Stack key={feature.title} gap="xs">
            <ThemeIcon variant="light" size="lg">
              <feature.icon size={20} stroke={1.5} />
            </ThemeIcon>
            <Text fw={600}>{feature.title}</Text>
            <Text size="sm" c="dimmed">
              {feature.text}
            </Text>
          </Stack>
        ))}
      </SimpleGrid>

      <Paper
        p={{ base: "lg", sm: "xl" }}
        bg="var(--mantine-primary-color-light)"
      >
        <Group justify="space-between" gap="md">
          <Stack gap={4}>
            <Title order={3}>Have a rig worth sharing?</Title>
            <Text c="dimmed">
              Paste your command and the speeds it printed. It takes about a
              minute.
            </Text>
          </Stack>
          <Button component={Link} to="/submit" size="md">
            Submit a result
          </Button>
        </Group>
      </Paper>
    </Stack>
  );
}

/** The newest submission, as a real example of what a result looks like. */
function LatestResult() {
  const latest = useLatestSubmission();

  if (latest.isPending) return <Skeleton h={260} radius="md" />;
  const submission = latest.data;
  if (!submission?.device) return null;

  const deviceName = deviceCountLabel(
    submission.device_count,
    submission.device.name,
  );
  const slug = deviceSlug(submission.device);

  return (
    <Card withBorder padding="lg" shadow="sm">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={0}>
            <Text size="xs" c="dimmed" fw={500}>
              Latest result
            </Text>
            <Text fw={600} size="lg">
              {deviceName}
            </Text>
          </Stack>
          <Badge variant="default" ff="monospace" tt="none">
            {submission.runtime}
          </Badge>
        </Group>
        <Code block>{submission.raw_command}</Code>
        <Stack gap={6}>
          <Text size="sm" c="dimmed" ff="monospace">
            {[submission.model, submission.quant].filter(Boolean).join(" · ")}
          </Text>
          <Group gap="xs" align="baseline">
            <Text ff="monospace" fz={{ base: 44, sm: 56 }} fw={600} lh={1}>
              {formatSpeed(submission.gen_tok_s)}
            </Text>
            <Text c="dimmed">tok/s gen</Text>
          </Group>
          <Text size="sm" c="dimmed">
            <Text span ff="monospace" c="var(--mantine-color-text)">
              {formatSpeed(submission.prompt_tok_s)}
            </Text>{" "}
            tok/s prompt
            {submission.context_size && (
              <>
                {" · "}
                <Text span ff="monospace" c="var(--mantine-color-text)">
                  {formatContext(submission.context_size)}
                </Text>{" "}
                ctx
              </>
            )}
          </Text>
        </Stack>
        <Anchor component={Link} to={`/device/${slug}`} size="sm">
          See all {submission.device.name} results
        </Anchor>
      </Stack>
    </Card>
  );
}

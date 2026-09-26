import {
  Badge,
  Button,
  Card,
  Collapse,
  Divider,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useState } from "react";
import type { Result } from "../lib/api";
import {
  deviceCountLabel,
  formatContext,
  formatSpeed,
  plural,
} from "../lib/format";
import { CommandList } from "./CommandList";

const PAGE_SIZE = 10;

/** Phone: one card per result, with median generation speed as the hero number. */
export function ResultCards({
  results,
  deviceName,
}: {
  results: Result[];
  deviceName: string;
}) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const remaining = results.length - shown;

  return (
    <Stack gap="sm">
      {results.slice(0, shown).map((result) => (
        <ResultCard key={result.key} result={result} deviceName={deviceName} />
      ))}
      {remaining > 0 && (
        <Button
          variant="default"
          fullWidth
          onClick={() => setShown(shown + PAGE_SIZE)}
        >
          Show{" "}
          {plural(Math.min(remaining, PAGE_SIZE), "more setup", "more setups")}
        </Button>
      )}
    </Stack>
  );
}

function ResultCard({
  result,
  deviceName,
}: {
  result: Result;
  deviceName: string;
}) {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Card withBorder padding="md">
      <Stack gap="xs">
        <Group
          justify="space-between"
          align="flex-start"
          wrap="nowrap"
          gap="xs"
        >
          <Title order={4}>{result.model}</Title>
          {result.deviceCount > 1 && (
            <Badge variant="default" size="sm">
              {deviceCountLabel(result.deviceCount, deviceName)}
            </Badge>
          )}
        </Group>
        <Group gap={6} align="baseline">
          <Text ff="monospace" fz="h1" fw={600} lh={1}>
            {formatSpeed(result.medianGenTokS)}
          </Text>
          <Text size="sm" c="dimmed">
            tok/s gen
          </Text>
        </Group>
        <Group gap="md">
          <Text size="sm" c="dimmed">
            <Text span ff="monospace" c="var(--mantine-color-text)">
              {formatSpeed(result.medianPromptTokS)}
            </Text>{" "}
            tok/s prompt
          </Text>
          {result.typicalContextSize && (
            <Text size="sm" c="dimmed">
              <Text span ff="monospace" c="var(--mantine-color-text)">
                {formatContext(result.typicalContextSize)}
              </Text>{" "}
              ctx
            </Text>
          )}
        </Group>
        <Group justify="space-between" gap="xs">
          <Text size="xs" c="dimmed" ff="monospace">
            {[result.quant, result.runtime].filter(Boolean).join(" · ")}
          </Text>
          <Text size="xs" c="dimmed">
            {plural(result.submissionCount, "submission", "submissions")}
          </Text>
        </Group>
        <Divider />
        <Button
          variant="subtle"
          size="compact-sm"
          w="fit-content"
          aria-expanded={opened}
          onClick={toggle}
          rightSection={
            opened ? (
              <IconChevronUp size={14} stroke={1.5} />
            ) : (
              <IconChevronDown size={14} stroke={1.5} />
            )
          }
        >
          {opened
            ? "Hide commands"
            : `Show ${plural(result.submissions.length, "command", "commands")}`}
        </Button>
        <Collapse expanded={opened}>
          <CommandList submissions={result.submissions} />
        </Collapse>
      </Stack>
    </Card>
  );
}

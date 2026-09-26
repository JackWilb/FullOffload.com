import {
  ActionIcon,
  Badge,
  Center,
  Group,
  Paper,
  Table,
  Text,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { Fragment, type ReactNode, useState } from "react";
import type { Result } from "../lib/api";
import {
  deviceCountLabel,
  formatContext,
  formatCount,
  formatSpeed,
} from "../lib/format";
import { defaultDirection, type Sort, type SortKey } from "../lib/results";
import { CommandList } from "./CommandList";

type ResultsViewProps = {
  results: Result[];
  deviceName: string;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
};

/** Desktop: a sortable table. Each row expands to show the commands behind it. */
export function ResultsTable({
  results,
  deviceName,
  sort,
  onSortChange,
}: ResultsViewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const header = (key: SortKey, label: string, numeric = false) => (
    <SortHeader
      label={label}
      numeric={numeric}
      sorted={sort.key === key ? sort.direction : null}
      onSort={() =>
        onSortChange({
          key,
          direction:
            sort.key === key
              ? sort.direction === "asc"
                ? "desc"
                : "asc"
              : defaultDirection(key),
        })
      }
    />
  );

  return (
    <Paper withBorder>
      <Table.ScrollContainer minWidth={760}>
        <Table striped highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={44}>
                <VisuallyHidden>Commands</VisuallyHidden>
              </Table.Th>
              <Table.Th>{header("model", "Model")}</Table.Th>
              <Table.Th>{header("quant", "Quant")}</Table.Th>
              <Table.Th>{header("runtime", "Runtime")}</Table.Th>
              <Table.Th>{header("gen", "Gen tok/s", true)}</Table.Th>
              <Table.Th>{header("prompt", "Prompt tok/s", true)}</Table.Th>
              <Table.Th>{header("context", "Context", true)}</Table.Th>
              <Table.Th>{header("count", "Submissions", true)}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.map((result) => {
              const open = expanded.has(result.key);
              return (
                <Fragment key={result.key}>
                  <Table.Tr>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color={open ? "brand" : "gray"}
                        aria-label={open ? "Hide commands" : "Show commands"}
                        aria-expanded={open}
                        onClick={() => toggle(result.key)}
                      >
                        {open ? (
                          <IconChevronDown size={16} stroke={1.5} />
                        ) : (
                          <IconChevronRight size={16} stroke={1.5} />
                        )}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="sm" fw={500}>
                          {result.model}
                        </Text>
                        {result.deviceCount > 1 && (
                          <Badge variant="default" size="sm">
                            {deviceCountLabel(result.deviceCount, deviceName)}
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {result.quant ?? "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {result.runtime}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600} ff="monospace">
                        {formatSpeed(result.medianGenTokS)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed" ff="monospace">
                        {formatSpeed(result.medianPromptTokS)}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed" ff="monospace">
                        {result.typicalContextSize
                          ? formatContext(result.typicalContextSize)
                          : "—"}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" c="dimmed" ff="monospace">
                        {formatCount(result.submissionCount)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  {open && (
                    <Table.Tr>
                      <Table.Td />
                      <Table.Td colSpan={7}>
                        <CommandList submissions={result.submissions} />
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Fragment>
              );
            })}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function SortHeader({
  label,
  numeric,
  sorted,
  onSort,
}: {
  label: string;
  numeric: boolean;
  sorted: Sort["direction"] | null;
  onSort: () => void;
}) {
  let icon: ReactNode = <IconSelector size={14} stroke={1.5} />;
  if (sorted === "asc") icon = <IconChevronUp size={14} stroke={1.5} />;
  if (sorted === "desc") icon = <IconChevronDown size={14} stroke={1.5} />;

  return (
    <UnstyledButton
      onClick={onSort}
      w="100%"
      aria-sort={
        sorted === null
          ? undefined
          : sorted === "asc"
            ? "ascending"
            : "descending"
      }
    >
      <Group
        gap={4}
        justify={numeric ? "flex-end" : "flex-start"}
        wrap="nowrap"
      >
        <Text size="sm" fw={500} c={sorted ? "brand" : undefined}>
          {label}
        </Text>
        <Center c={sorted ? "brand" : "dimmed"}>{icon}</Center>
      </Group>
    </UnstyledButton>
  );
}

import {
  ActionIcon,
  Button,
  Code,
  CopyButton,
  Group,
  Popover,
  Stack,
  Text,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconCheck, IconCopy, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { errorMessage, type Submission, useDeleteSubmission } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatContext, formatDate, formatSpeed, plural } from "../lib/format";

const INITIAL_COUNT = 3;

/** The exact commands behind a result, newest first, each with its own measured speeds. */
export function CommandList({ submissions }: { submissions: Submission[] }) {
  const { session } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? submissions : submissions.slice(0, INITIAL_COUNT);
  const hidden = submissions.length - visible.length;

  return (
    <Stack gap="sm">
      {visible.map((submission) => (
        <Stack key={submission.id} gap={4}>
          <Code block>{submission.raw_command}</Code>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text size="xs" c="dimmed" ff="monospace">
              {[
                `${formatSpeed(submission.gen_tok_s)} gen`,
                `${formatSpeed(submission.prompt_tok_s)} prompt`,
                submission.context_size
                  ? `${formatContext(submission.context_size)} ctx`
                  : null,
                plural(submission.device_count, "device", "devices"),
                formatDate(submission.created_at),
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
            <Group gap={4} wrap="nowrap">
              <CopyButton value={submission.raw_command}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? "Copied" : "Copy command"} withArrow>
                    <ActionIcon
                      variant="subtle"
                      color={copied ? "success" : "gray"}
                      aria-label="Copy command"
                      onClick={copy}
                    >
                      {copied ? (
                        <IconCheck size={16} stroke={1.5} />
                      ) : (
                        <IconCopy size={16} stroke={1.5} />
                      )}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
              {session?.user.id === submission.user_id && (
                <DeleteButton submissionId={submission.id} />
              )}
            </Group>
          </Group>
        </Stack>
      ))}
      {hidden > 0 && (
        <Button
          variant="subtle"
          size="compact-sm"
          onClick={() => setShowAll(true)}
          w="fit-content"
        >
          Show {plural(hidden, "more command", "more commands")}
        </Button>
      )}
    </Stack>
  );
}

function DeleteButton({ submissionId }: { submissionId: number }) {
  const [opened, { close, toggle }] = useDisclosure(false);
  const remove = useDeleteSubmission();

  return (
    <Popover opened={opened} onChange={toggle} position="bottom-end" withArrow>
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          color="danger"
          aria-label="Delete your result"
          onClick={toggle}
        >
          <IconTrash size={16} stroke={1.5} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" maw={240}>
          <Text size="sm">Delete your result? This can't be undone.</Text>
          {remove.error && (
            <Text size="xs" c="danger">
              {errorMessage(remove.error)}
            </Text>
          )}
          <Group gap="xs" justify="flex-end">
            <Button variant="default" size="xs" onClick={close}>
              Keep it
            </Button>
            <Button
              color="danger"
              size="xs"
              loading={remove.isPending}
              onClick={() => remove.mutate(submissionId, { onSuccess: close })}
            >
              Delete
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

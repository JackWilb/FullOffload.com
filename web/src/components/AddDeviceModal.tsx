import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { deviceMemoryLabel } from "../lib/format";
import type { Device } from "../lib/devices";

type AddDeviceModalProps = {
  /** The name to add; the modal is open while it is set. */
  name: string | null;
  suggestions: Device[];
  adding: boolean;
  error: string | null;
  onPick: (device: Device) => void;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirms a new, unverified device, offering close existing matches first. */
export function AddDeviceModal({
  name,
  suggestions,
  adding,
  error,
  onPick,
  onConfirm,
  onClose,
}: AddDeviceModalProps) {
  return (
    <Modal
      opened={name !== null}
      onClose={onClose}
      title="Add a new device?"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          New devices show as unverified until their specs are checked. Your
          result will still appear right away.
        </Text>
        <Card withBorder padding="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600}>{name}</Text>
            <Badge color="unverified" variant="outline">
              Unverified
            </Badge>
          </Group>
        </Card>
        {suggestions.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Is it one of these instead?
            </Text>
            {suggestions.map((device) => (
              <Button
                key={device.id}
                variant="default"
                fullWidth
                justify="space-between"
                rightSection={
                  <Text size="xs" c="dimmed">
                    {[device.vendor, deviceMemoryLabel(device)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                }
                onClick={() => onPick(device)}
              >
                {device.name}
              </Button>
            ))}
          </Stack>
        )}
        {error && (
          <Alert color="danger" variant="light" title="Couldn't add the device">
            {error}
          </Alert>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Back
          </Button>
          <Button onClick={onConfirm} loading={adding}>
            Add {name}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

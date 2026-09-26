import {
  Autocomplete,
  type AutocompleteProps,
  Group,
  Text,
} from "@mantine/core";
import { IconPlus, IconSearch } from "@tabler/icons-react";
import { type Ref, useMemo } from "react";
import { deviceMemoryLabel } from "../lib/format";
import {
  type Device,
  type DeviceAlias,
  findExactDevice,
  searchDevices,
  suggestSimilarDevices,
} from "../lib/devices";

const MAX_OPTIONS = 50;

type DevicePickerProps = Omit<
  AutocompleteProps,
  | "data"
  | "value"
  | "onChange"
  | "onOptionSubmit"
  | "renderOption"
  | "filter"
  | "onSelect"
> & {
  ref?: Ref<HTMLInputElement>;
  devices: Device[];
  aliases: DeviceAlias[];
  search: string;
  onSearchChange: (search: string) => void;
  onDeviceSelect: (device: Device) => void;
  /** When set, a name with no exact match offers "Add “name” as a new device". */
  onAddDevice?: (name: string) => void;
};

/**
 * The searchable device list. Searching a family ("m3 max") lists every memory variant; when
 * adding is allowed and nothing matches exactly, close matches come first, then the add option.
 */
export function DevicePicker({
  devices,
  aliases,
  search,
  onSearchChange,
  onDeviceSelect,
  onAddDevice,
  ...props
}: DevicePickerProps) {
  const byName = useMemo(
    () => new Map(devices.map((device) => [device.name, device])),
    [devices],
  );
  const addName = search.trim();

  const data = useMemo((): NonNullable<AutocompleteProps["data"]> => {
    const matches = searchDevices(devices, search)
      .slice(0, MAX_OPTIONS)
      .map((device) => device.name);
    const canAdd =
      onAddDevice !== undefined &&
      addName.length >= 2 &&
      addName.length <= 80 &&
      !findExactDevice(devices, aliases, addName);
    if (!canAdd) return matches;
    if (matches.length > 0) return [...matches, addName];

    const suggestions = suggestSimilarDevices(devices, addName).map(
      (device) => device.name,
    );
    return suggestions.length > 0
      ? [
          { group: "No exact match. Did you mean…?", items: suggestions },
          addName,
        ]
      : [addName];
  }, [devices, aliases, search, addName, onAddDevice]);

  return (
    <Autocomplete
      leftSection={<IconSearch size={16} stroke={1.5} />}
      {...props}
      data={data}
      value={search}
      onChange={onSearchChange}
      filter={({ options }) => options}
      maxDropdownHeight={320}
      onOptionSubmit={(value) => {
        const device = byName.get(value);
        if (device) onDeviceSelect(device);
        else onAddDevice?.(value);
      }}
      renderOption={({ option }) => {
        const device = byName.get(option.value);
        if (!device) {
          return (
            <Group gap="xs" wrap="nowrap">
              <IconPlus size={16} stroke={1.5} />
              <Text size="sm" fw={500} c="brand">
                Add “{option.value}” as a new device
              </Text>
            </Group>
          );
        }
        return (
          <Group justify="space-between" wrap="nowrap" w="100%" gap="sm">
            <Text size="sm">{device.name}</Text>
            <Text size="xs" c="dimmed" ta="right">
              {device.status === "curated"
                ? [device.vendor, deviceMemoryLabel(device)]
                    .filter(Boolean)
                    .join(" · ")
                : "Unverified"}
            </Text>
          </Group>
        );
      }}
    />
  );
}

import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Loader,
  Paper,
  Select,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { DevicePicker } from "../components/DevicePicker";
import { ResultCards } from "../components/ResultCards";
import { ResultsTable } from "../components/ResultsTable";
import { SpeedHints } from "../components/SpeedHints";
import { errorMessage, useDeviceList, useDeviceResults } from "../lib/api";
import {
  type Device,
  type DeviceAlias,
  deviceSlug,
  findDeviceBySlug,
} from "../lib/devices";
import { deviceBandwidthLabel, deviceMemoryLabel, plural } from "../lib/format";
import {
  DEFAULT_SORT,
  defaultDirection,
  type Sort,
  type SortKey,
  sortResults,
} from "../lib/results";

const ALL_RUNTIMES = "all";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "gen", label: "Generation speed" },
  { value: "prompt", label: "Prompt speed" },
  { value: "count", label: "Submissions" },
  { value: "context", label: "Context size" },
  { value: "model", label: "Model" },
];

export function DevicePage() {
  const { slug = "" } = useParams();
  const deviceList = useDeviceList();

  if (deviceList.isPending) return <Loader mx="auto" display="block" />;
  if (deviceList.isError) {
    return (
      <Alert color="danger" variant="light" title="Couldn't load devices">
        {errorMessage(deviceList.error)}
      </Alert>
    );
  }

  const { devices, aliases } = deviceList.data;
  const device = findDeviceBySlug(devices, aliases, slug);

  if (!device) {
    return (
      <Stack gap="md" maw={560}>
        <title>Device not found · Full Offload</title>
        <Title order={2}>We don't know that device</Title>
        <Text c="dimmed">
          Search for it below, or add it when you submit a result.
        </Text>
        <DeviceSearch devices={devices} aliases={aliases} initial="" />
      </Stack>
    );
  }

  return (
    <DeviceResults
      key={device.id}
      device={device}
      devices={devices}
      aliases={aliases}
    />
  );
}

function DeviceSearch({
  devices,
  aliases,
  initial,
  label,
}: {
  devices: Device[];
  aliases: DeviceAlias[];
  initial: string;
  label?: string;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState(initial);
  return (
    <DevicePicker
      label={label}
      aria-label={label ? undefined : "Device"}
      placeholder="Search your GPU or Mac"
      devices={devices}
      aliases={aliases}
      search={search}
      onSearchChange={setSearch}
      onDeviceSelect={(picked) =>
        void navigate(`/device/${deviceSlug(picked)}`)
      }
    />
  );
}

function DeviceResults({
  device,
  devices,
  aliases,
}: {
  device: Device;
  devices: Device[];
  aliases: DeviceAlias[];
}) {
  const location = useLocation();
  const results = useDeviceResults(device.id);
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [runtime, setRuntime] = useState<string>(ALL_RUNTIMES);
  const [modelFilter, setModelFilter] = useState("");
  const [savedNotice, setSavedNotice] = useState(
    (location.state as { submitted?: boolean } | null)?.submitted === true,
  );

  const rows = useMemo(() => results.data ?? [], [results.data]);
  const runtimes = useMemo(
    () => [...new Set(rows.map((row) => row.runtime))].sort(),
    [rows],
  );
  const visible = useMemo(() => {
    const model = modelFilter.trim().toLowerCase();
    return sortResults(
      rows.filter(
        (row) =>
          (runtime === ALL_RUNTIMES || row.runtime === runtime) &&
          (!model || row.model.includes(model)),
      ),
      sort,
    );
  }, [rows, runtime, modelFilter, sort]);

  const submissionCount = rows.reduce(
    (sum, row) => sum + row.submissionCount,
    0,
  );
  const slug = deviceSlug(device);
  const submitLink = `/submit?device=${slug}`;
  const memory = deviceMemoryLabel(device);
  const bandwidth = deviceBandwidthLabel(device);

  const runtimeSelect = (
    <Select
      label="Runtime"
      data={[
        { value: ALL_RUNTIMES, label: "All runtimes" },
        ...runtimes.map((value) => ({ value, label: value })),
      ]}
      value={runtime}
      onChange={(value) => setRuntime(value ?? ALL_RUNTIMES)}
      allowDeselect={false}
    />
  );

  return (
    <Stack gap="lg">
      <title>{`${device.name} local LLM speeds · Full Offload`}</title>

      <Box maw={{ sm: 360 }}>
        <DeviceSearch
          devices={devices}
          aliases={aliases}
          initial={device.name}
        />
      </Box>

      {savedNotice && (
        <Alert
          color="success"
          variant="light"
          title="Result saved"
          withCloseButton
          onClose={() => setSavedNotice(false)}
        >
          Your result is public now. Thanks for sharing it.
        </Alert>
      )}

      <Group justify="space-between" align="flex-end" gap="md">
        <Stack gap="xs">
          <Stack gap={2}>
            {device.vendor && (
              <Text size="xs" c="dimmed" fw={500}>
                {device.vendor}
              </Text>
            )}
            <Title order={1}>{device.name}</Title>
          </Stack>
          <Group gap={6}>
            {device.status === "curated" ? (
              <Badge
                color="verified"
                variant="light"
                leftSection={<IconCheck size={12} stroke={2.5} />}
              >
                Verified
              </Badge>
            ) : (
              <Badge color="unverified" variant="outline">
                Unverified
              </Badge>
            )}
            {memory && (
              <Badge variant="default">
                {memory} {device.unified_memory ? "unified" : "VRAM"}
              </Badge>
            )}
            {bandwidth && <Badge variant="default">{bandwidth}</Badge>}
            {rows.length > 0 && (
              <Text size="sm" c="dimmed">
                {plural(rows.length, "setup", "setups")} from{" "}
                {plural(submissionCount, "submission", "submissions")}
              </Text>
            )}
          </Group>
          {device.status === "user_added" && (
            <Text size="xs" c="dimmed">
              Added by a visitor. Specs appear once they've been checked.
            </Text>
          )}
        </Stack>
        {rows.length > 0 && (
          <Button
            component={Link}
            to={submitLink}
            variant="light"
            visibleFrom="sm"
          >
            Submit a result for {device.name}
          </Button>
        )}
      </Group>

      {results.isPending && <Skeleton h={240} radius="md" />}
      {results.isError && (
        <Alert color="danger" variant="light" title="Couldn't load results">
          {errorMessage(results.error)}
        </Alert>
      )}
      {results.isSuccess && rows.length === 0 && (
        <EmptyState device={device} submitLink={submitLink} />
      )}

      {rows.length > 0 && (
        <>
          <SimpleGrid cols={2} spacing="sm" hiddenFrom="sm">
            <Select
              label="Sort by"
              data={SORT_OPTIONS}
              value={sort.key}
              onChange={(value) => {
                const key = value ?? DEFAULT_SORT.key;
                setSort({ key, direction: defaultDirection(key) });
              }}
              allowDeselect={false}
            />
            {runtimeSelect}
          </SimpleGrid>
          <Group align="flex-end" gap="sm" visibleFrom="sm">
            <TextInput
              label="Model"
              placeholder="Filter by model name"
              value={modelFilter}
              onChange={(event) => setModelFilter(event.currentTarget.value)}
              w={260}
            />
            <div>{runtimeSelect}</div>
            <Text size="xs" c="dimmed" ml="auto" pb={8}>
              Speeds are medians across submissions.
            </Text>
          </Group>

          {visible.length === 0 ? (
            <Text c="dimmed">No results match these filters.</Text>
          ) : (
            <>
              <Box hiddenFrom="sm">
                <ResultCards results={visible} deviceName={device.name} />
              </Box>
              <Box visibleFrom="sm">
                <ResultsTable
                  results={visible}
                  deviceName={device.name}
                  sort={sort}
                  onSortChange={setSort}
                />
              </Box>
            </>
          )}
        </>
      )}
    </Stack>
  );
}

function EmptyState({
  device,
  submitLink,
}: {
  device: Device;
  submitLink: string;
}) {
  return (
    <Paper withBorder p={{ base: "lg", sm: 40 }}>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing={48}>
        <Stack gap="md">
          <Title order={2}>No results for the {device.name} yet</Title>
          <Text c="dimmed">
            Be the first to share how fast models run on it. Paste the command
            you ran and the speeds it reported. It takes about a minute.
          </Text>
          <Group gap="md">
            <Button component={Link} to={submitLink} size="md">
              Submit the first result
            </Button>
            <Text size="xs" c="dimmed">
              You'll sign in with GitHub, Google or email.
            </Text>
          </Group>
          <Stack gap="xs" mt="sm">
            <Text size="sm" fw={600}>
              Where to find your speeds
            </Text>
            <SpeedHints compact />
          </Stack>
        </Stack>
        <Paper
          p="xl"
          bg="var(--mantine-primary-color-light)"
          visibleFrom="md"
          aria-hidden
        >
          <Stack gap="sm">
            <Text size="xs" fw={500} c="brand">
              Your result will appear here
            </Text>
            <Card withBorder shadow="sm">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Skeleton h={12} w="45%" animate={false} />
                  <Skeleton h={10} w="18%" animate={false} />
                </Group>
                <Group gap="xs" align="baseline">
                  <Text ff="monospace" fz={44} fw={600} lh={1} c="dimmed">
                    —.—
                  </Text>
                  <Text size="sm" c="dimmed">
                    tok/s gen
                  </Text>
                </Group>
                <Skeleton h={10} w="62%" animate={false} />
                <Skeleton h={34} animate={false} />
              </Stack>
            </Card>
          </Stack>
        </Paper>
      </SimpleGrid>
      <Anchor
        component={Link}
        to="/"
        size="sm"
        hiddenFrom="md"
        mt="lg"
        display="block"
      >
        Look up another device
      </Anchor>
    </Paper>
  );
}

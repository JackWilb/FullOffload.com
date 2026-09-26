import {
  Accordion,
  Alert,
  Badge,
  Button,
  Center,
  Divider,
  Grid,
  Group,
  Loader,
  NumberInput,
  Paper,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AddDeviceModal } from "../components/AddDeviceModal";
import { DevicePicker } from "../components/DevicePicker";
import { SignInPanel } from "../components/SignInPanel";
import { SpeedHints } from "../components/SpeedHints";
import {
  DeviceExistsError,
  type DeviceList,
  errorMessage,
  useAddDevice,
  useCreateSubmission,
  useDeviceList,
} from "../lib/api";
import { useAuth } from "../lib/auth";
import {
  type Device,
  deviceSlug,
  findDeviceBySlug,
  findExactDevice,
  suggestSimilarDevices,
} from "../lib/devices";
import {
  canonicalQuant,
  type ParsedCommand,
  parseCommand,
} from "../parser/parseCommand";

const MAX_SPEED = 100_000;
const MAX_CONTEXT_SIZE = 10_000_000;

export function Submit() {
  const { session, loading } = useAuth();
  const deviceList = useDeviceList();

  if (loading || deviceList.isPending)
    return <Loader mx="auto" display="block" />;

  if (!session) {
    return (
      <Center>
        <title>Sign in · Full Offload</title>
        <Paper
          withBorder
          shadow="sm"
          p={{ base: "lg", sm: "xl" }}
          maw={440}
          w="100%"
        >
          <SignInPanel />
        </Paper>
      </Center>
    );
  }

  if (deviceList.isError) {
    return (
      <Alert color="danger" variant="light" title="Couldn't load devices">
        {errorMessage(deviceList.error)}
      </Alert>
    );
  }

  return <SubmitForm deviceList={deviceList.data} />;
}

type FormValues = {
  device: string;
  deviceCount: number | string;
  rawCommand: string;
  runtime: string;
  model: string;
  quant: string;
  contextSize: number | string;
  genTokS: number | string;
  promptTokS: number | string;
};

const EMPTY_PARSE: ParsedCommand = {
  runtime: null,
  model: null,
  quant: null,
  contextSize: null,
};

function speedError(label: string, value: number | string): string | null {
  if (value === "") return `Enter the ${label.toLowerCase()}.`;
  const speed = Number(value);
  if (!(speed > 0)) return `${label} must be above 0 tok/s.`;
  if (speed > MAX_SPEED) return `${label} must be at most 100,000 tok/s.`;
  return null;
}

function SubmitForm({ deviceList }: { deviceList: DeviceList }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { devices, aliases } = deviceList;
  const createSubmission = useCreateSubmission();
  const addDevice = useAddDevice();
  const refetchDevices = useDeviceList().refetch;

  const [parsed, setParsed] = useState<ParsedCommand>(EMPTY_PARSE);
  const lastParsed = useRef<ParsedCommand>(EMPTY_PARSE);
  const [addName, setAddName] = useState<string | null>(null);

  const preselected = findDeviceBySlug(
    devices,
    aliases,
    searchParams.get("device") ?? "",
  );

  const form = useForm<FormValues>({
    initialValues: {
      device: preselected?.name ?? "",
      deviceCount: 1,
      rawCommand: "",
      runtime: "",
      model: "",
      quant: "",
      contextSize: "",
      genTokS: "",
      promptTokS: "",
    },
    validate: {
      device: (value) =>
        findExactDevice(devices, aliases, value)
          ? null
          : "Pick a device from the list, or add it as a new device.",
      deviceCount: (value) =>
        Number.isInteger(Number(value)) &&
        Number(value) >= 1 &&
        Number(value) <= 16
          ? null
          : "Enter how many devices ran it, from 1 to 16.",
      rawCommand: (value) => {
        if (!value.trim()) return "Paste the command you ran.";
        if (value.length > 4000)
          return "Commands can be at most 4,000 characters.";
        return null;
      },
      runtime: (value) => {
        if (!value.trim()) return "Enter the runtime, for example llama.cpp.";
        return value.trim().length > 40
          ? "Runtime names can be at most 40 characters."
          : null;
      },
      model: (value) => {
        if (!value.trim()) return "Enter the model name.";
        return value.trim().length > 200
          ? "Model names can be at most 200 characters."
          : null;
      },
      quant: (value) =>
        value.trim().length > 40
          ? "Quant names can be at most 40 characters."
          : null,
      contextSize: (value) => {
        if (value === "") return null;
        const size = Number(value);
        return Number.isInteger(size) && size >= 1 && size <= MAX_CONTEXT_SIZE
          ? null
          : "Context size must be a whole number from 1 to 10,000,000 tokens.";
      },
      genTokS: (value) => speedError("Generation speed", value),
      promptTokS: (value) => speedError("Prompt processing speed", value),
    },
  });

  // Re-parse on every edit, but only overwrite fields the user hasn't changed by hand.
  const onCommandChange = (rawCommand: string) => {
    form.setFieldValue("rawCommand", rawCommand);
    const next = parseCommand(rawCommand);
    const previous = lastParsed.current;
    const values = form.getValues();
    const keep = (current: string | number, before: string | number | null) =>
      current !== (before ?? "");
    form.setValues({
      runtime: keep(values.runtime, previous.runtime)
        ? values.runtime
        : (next.runtime ?? ""),
      model: keep(values.model, previous.model)
        ? values.model
        : (next.model ?? ""),
      quant: keep(values.quant, previous.quant)
        ? values.quant
        : (next.quant ?? ""),
      contextSize: keep(values.contextSize, previous.contextSize)
        ? values.contextSize
        : (next.contextSize ?? ""),
    });
    lastParsed.current = next;
    setParsed(next);
  };

  const selectDevice = (device: Device) => {
    form.setFieldValue("device", device.name);
    form.clearFieldError("device");
    setAddName(null);
  };

  const confirmAddDevice = () => {
    if (!addName) return;
    addDevice.mutate(addName, {
      onSuccess: selectDevice,
      onError: (error) => {
        // Someone already added it (or it's an alias): reuse the existing device.
        if (!(error instanceof DeviceExistsError)) return;
        void refetchDevices().then(({ data }) => {
          const existing =
            data && findExactDevice(data.devices, data.aliases, addName);
          if (existing) selectDevice(existing);
        });
      },
    });
  };

  const handleSubmit = form.onSubmit((values) => {
    const device = findExactDevice(devices, aliases, values.device);
    if (!device) return;
    createSubmission.mutate(
      {
        device_id: device.id,
        device_count: Number(values.deviceCount),
        raw_command: values.rawCommand.trim(),
        runtime: values.runtime.trim().toLowerCase(),
        model: values.model.trim().toLowerCase(),
        quant: canonicalQuant(values.quant),
        context_size:
          values.contextSize === "" ? null : Number(values.contextSize),
        gen_tok_s: Number(values.genTokS),
        prompt_tok_s: Number(values.promptTokS),
      },
      {
        onSuccess: () =>
          void navigate(`/device/${deviceSlug(device)}`, {
            state: { submitted: true },
          }),
      },
    );
  });

  const parsedCount = Object.values(parsed).filter(
    (value) => value !== null,
  ).length;
  const submitError = createSubmission.error;
  const rateLimited =
    (submitError as { code?: string } | null)?.code === "PT429";

  return (
    <Grid gap={48}>
      <title>Submit a result · Full Offload</title>
      <Grid.Col span={{ base: 12, md: 8 }}>
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="xl">
            <Stack gap={6}>
              <Title order={1}>Submit a result</Title>
              <Text c="dimmed">
                Paste the command you ran and the speeds it reported. We fill in
                the rest from the command.
              </Text>
            </Stack>

            <Stack gap="sm">
              <Title order={4}>Hardware</Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 8 }}>
                  <DevicePicker
                    label="Device"
                    description="Can't find it? Type its name to add it."
                    withAsterisk
                    size="md"
                    placeholder="Search your GPU or Mac"
                    devices={devices}
                    aliases={aliases}
                    search={form.values.device}
                    onSearchChange={(value) =>
                      form.setFieldValue("device", value)
                    }
                    onDeviceSelect={selectDevice}
                    onAddDevice={(name) => {
                      addDevice.reset();
                      setAddName(name);
                    }}
                    error={form.errors.device}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 4 }}>
                  <NumberInput
                    label="Number of devices"
                    description="Cards the model ran across"
                    withAsterisk
                    size="md"
                    min={1}
                    max={16}
                    allowDecimal={false}
                    allowNegative={false}
                    {...form.getInputProps("deviceCount")}
                  />
                </Grid.Col>
              </Grid>
            </Stack>

            <Stack gap="sm">
              <Title order={4}>Command</Title>
              <Textarea
                label="Command you ran"
                description="Include every flag. It's shown next to your result."
                withAsterisk
                size="md"
                autosize
                minRows={3}
                placeholder="llama-server -m model.gguf -ngl 99 -c 8192"
                {...form.getInputProps("rawCommand")}
                onChange={(event) => onCommandChange(event.currentTarget.value)}
              />
            </Stack>

            <Paper
              p={{ base: "md", sm: "lg" }}
              bg="var(--mantine-primary-color-light)"
            >
              <Stack gap="md">
                <Group justify="space-between" gap="xs">
                  <Group gap="xs">
                    <IconCheck
                      size={18}
                      stroke={1.5}
                      color="var(--mantine-primary-color-light-color)"
                    />
                    <Title order={4}>Filled from your command</Title>
                  </Group>
                  {parsedCount > 0 && (
                    <Badge variant="light">{`${parsedCount} ${parsedCount === 1 ? "field" : "fields"}`}</Badge>
                  )}
                </Group>
                <Text size="sm" c="dimmed" mt={-8}>
                  {form.values.rawCommand.trim() && parsedCount === 0
                    ? "We couldn't read this command. Fill these in yourself."
                    : "Check them and fix anything that's wrong."}
                </Text>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Runtime"
                      withAsterisk
                      size="md"
                      placeholder="llama.cpp"
                      {...form.getInputProps("runtime")}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Model"
                      withAsterisk
                      size="md"
                      placeholder="qwen3-30b-a3b"
                      {...form.getInputProps("model")}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <TextInput
                      label="Quant"
                      size="md"
                      placeholder="q4_k_m"
                      {...form.getInputProps("quant")}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <NumberInput
                      label="Context size"
                      size="md"
                      placeholder="32768"
                      rightSection={
                        <Text size="xs" c="dimmed">
                          tokens
                        </Text>
                      }
                      rightSectionWidth={60}
                      min={1}
                      max={MAX_CONTEXT_SIZE}
                      allowDecimal={false}
                      allowNegative={false}
                      thousandSeparator=","
                      hideControls
                      {...form.getInputProps("contextSize")}
                    />
                  </Grid.Col>
                </Grid>
              </Stack>
            </Paper>

            <Stack gap="sm">
              <Title order={4}>Measured speeds</Title>
              <Grid>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Generation speed"
                    description="Tokens generated per second"
                    withAsterisk
                    size="md"
                    rightSection={
                      <Text size="xs" c="dimmed">
                        tok/s
                      </Text>
                    }
                    rightSectionWidth={52}
                    min={0}
                    max={MAX_SPEED}
                    decimalScale={2}
                    allowNegative={false}
                    thousandSeparator=","
                    hideControls
                    {...form.getInputProps("genTokS")}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6 }}>
                  <NumberInput
                    label="Prompt processing speed"
                    description="Prompt tokens processed per second"
                    withAsterisk
                    size="md"
                    rightSection={
                      <Text size="xs" c="dimmed">
                        tok/s
                      </Text>
                    }
                    rightSectionWidth={52}
                    min={0}
                    max={MAX_SPEED}
                    decimalScale={2}
                    allowNegative={false}
                    thousandSeparator=","
                    hideControls
                    {...form.getInputProps("promptTokS")}
                  />
                </Grid.Col>
              </Grid>
              <Accordion variant="contained" hiddenFrom="md">
                <Accordion.Item value="where">
                  <Accordion.Control>
                    Where do I find these numbers?
                  </Accordion.Control>
                  <Accordion.Panel>
                    <SpeedHints />
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>

            {submitError && (
              <Alert
                color={rateLimited ? "warning" : "danger"}
                variant="light"
                title={
                  rateLimited
                    ? "Rate limit reached"
                    : "Couldn't save your result"
                }
              >
                {errorMessage(submitError)}
              </Alert>
            )}

            <Divider />
            <Group justify="space-between" gap="md">
              <Text size="xs" c="dimmed">
                Results are public. You can delete your own submissions at any
                time.
              </Text>
              <Group gap="sm">
                <Button
                  variant="default"
                  size="md"
                  onClick={() => void navigate(-1)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="md"
                  loading={createSubmission.isPending}
                >
                  Submit result
                </Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Grid.Col>

      <Grid.Col span={{ base: 12, md: 4 }} visibleFrom="md">
        <Paper withBorder p="lg" mt={108}>
          <Stack gap="md">
            <Title order={4}>Where to find these numbers</Title>
            <SpeedHints />
          </Stack>
        </Paper>
      </Grid.Col>

      <AddDeviceModal
        name={addName}
        suggestions={addName ? suggestSimilarDevices(devices, addName) : []}
        adding={addDevice.isPending}
        error={
          addDevice.error && !(addDevice.error instanceof DeviceExistsError)
            ? errorMessage(addDevice.error)
            : null
        }
        onPick={selectDevice}
        onConfirm={confirmAddDevice}
        onClose={() => setAddName(null)}
      />
    </Grid>
  );
}

import {
  Alert,
  Anchor,
  Button,
  Divider,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import {
  IconBrandGithub,
  IconBrandGoogle,
  IconMail,
} from "@tabler/icons-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { errorMessage } from "../lib/api";
import { sendMagicLink, signInWithProvider } from "../lib/auth";

/** GitHub, Google or an emailed magic link. Returns to the current page after signing in. */
export function SignInPanel() {
  const location = useLocation();
  const next = `${location.pathname}${location.search}`;
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"github" | "google" | "email" | null>(
    null,
  );
  const [sentTo, setSentTo] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: "" },
    validate: {
      email: (value) =>
        /^\S+@\S+\.\S+$/.test(value.trim())
          ? null
          : "Enter a valid email address.",
    },
  });

  const withProvider = async (provider: "github" | "google") => {
    setError(null);
    setPending(provider);
    try {
      await signInWithProvider(provider, next);
    } catch (err) {
      setError(errorMessage(err));
      setPending(null);
    }
  };

  const withEmail = form.onSubmit(async ({ email }) => {
    setError(null);
    setPending("email");
    try {
      await sendMagicLink(email.trim(), next);
      setSentTo(email.trim());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  });

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Title order={2}>Sign in to submit results</Title>
        <Text size="sm" c="dimmed">
          Browsing is open to everyone. You only need an account to submit
          results and delete your own.
        </Text>
      </Stack>

      <Stack gap="sm">
        <Button
          variant="default"
          size="md"
          fullWidth
          leftSection={<IconBrandGithub size={18} stroke={1.5} />}
          loading={pending === "github"}
          onClick={() => void withProvider("github")}
        >
          Continue with GitHub
        </Button>
        <Button
          variant="default"
          size="md"
          fullWidth
          leftSection={<IconBrandGoogle size={18} stroke={1.5} />}
          loading={pending === "google"}
          onClick={() => void withProvider("google")}
        >
          Continue with Google
        </Button>
      </Stack>

      <Divider label="or use email" labelPosition="center" />

      {sentTo ? (
        <Alert color="success" variant="light" title="Check your email">
          We sent a sign-in link to {sentTo}. Open it in this browser to finish
          signing in.
        </Alert>
      ) : (
        <form onSubmit={withEmail} noValidate>
          <Stack gap="sm">
            <TextInput
              label="Email"
              type="email"
              size="md"
              placeholder="you@example.com"
              autoComplete="email"
              leftSection={<IconMail size={18} stroke={1.5} />}
              {...form.getInputProps("email")}
            />
            <Button
              type="submit"
              size="md"
              fullWidth
              loading={pending === "email"}
            >
              Email me a sign-in link
            </Button>
          </Stack>
        </form>
      )}

      {error && (
        <Alert color="danger" variant="light" title="Sign-in didn't start">
          {error}
        </Alert>
      )}

      <Text size="xs" c="dimmed">
        We use your email only to sign you in. Read the{" "}
        <Anchor component={Link} to="/privacy" inherit>
          privacy policy
        </Anchor>
        .
      </Text>
    </Stack>
  );
}

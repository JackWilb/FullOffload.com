import {
  Alert,
  Anchor,
  Center,
  Group,
  Loader,
  Stack,
  Text,
} from "@mantine/core";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { authErrorFromUrl, authNext, useAuth } from "../lib/auth";

/**
 * Where GitHub, Google and magic-link sign-ins land. supabase-js exchanges the ?code= for a
 * session on load; this page then returns to where sign-in started.
 */
export function AuthCallback() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const error = authErrorFromUrl();

  useEffect(() => {
    if (!loading && session) void navigate(authNext(), { replace: true });
  }, [loading, session, navigate]);

  if (error || (!loading && !session)) {
    return (
      <Stack maw={520} mx="auto">
        <title>Sign-in failed · Full Offload</title>
        <Alert color="danger" variant="light" title="We couldn't sign you in">
          <Text size="sm">
            {error ??
              "The sign-in link may have expired, or it was opened in a different browser from the one you started in."}
          </Text>
          <Anchor component={Link} to="/submit" size="sm">
            Try again
          </Anchor>
        </Alert>
      </Stack>
    );
  }

  return (
    <Center py="xl">
      <title>Signing in · Full Offload</title>
      <Group gap="sm">
        <Loader size="sm" />
        <Text c="dimmed">Signing you in…</Text>
      </Group>
    </Center>
  );
}

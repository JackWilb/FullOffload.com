import { Anchor, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router";
import { AuthCallback } from "./AuthCallback";

export function NotFound() {
  // An auth error redirect can replace the whole hash ("#error=..."); show it properly.
  if (window.location.hash.includes("error_description"))
    return <AuthCallback />;

  return (
    <Stack gap="sm">
      <title>Page not found · Full Offload</title>
      <Title order={1}>Page not found</Title>
      <Text c="dimmed">That link doesn't lead anywhere.</Text>
      <Anchor component={Link} to="/">
        Look up your hardware
      </Anchor>
    </Stack>
  );
}

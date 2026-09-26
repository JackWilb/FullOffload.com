import { Anchor, List, Stack, Text, Title } from "@mantine/core";

const CONTACT_EMAIL = "privacy@fulloffload.com";

export function Privacy() {
  return (
    <Stack gap="lg" maw={720}>
      <title>Privacy · Full Offload</title>
      <Stack gap={6}>
        <Title order={1}>Privacy policy</Title>
        <Text c="dimmed">Last updated September 26, 2026.</Text>
      </Stack>

      <Text>
        Full Offload collects as little as it can: enough to let you sign in and
        submit results. There are no ads, no analytics and no tracking cookies.
      </Text>

      <Stack gap="xs">
        <Title order={3}>What we collect</Title>
        <List spacing="xs">
          <List.Item>
            <Text span fw={600}>
              Your sign-in identity.
            </Text>{" "}
            When you sign in with GitHub, Google or an email link, our auth
            provider (Supabase) stores your email address, and for GitHub or
            Google your name and avatar. We use it only to sign you in.
          </List.Item>
          <List.Item>
            <Text span fw={600}>
              The results you submit.
            </Text>{" "}
            The device, device count, command, runtime, model, quant, context
            size, the two speeds, and when you submitted them.
          </List.Item>
        </List>
        <Text>
          Browsing needs no account, and we collect nothing about visitors who
          don't sign in.
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={3}>Submissions are public</Title>
        <Text>
          Everything you submit is shown publicly, including the exact command,
          and anyone can read it through the site or its public API. Each
          submission is stored with a random account ID so you can delete it
          later; the ID doesn't reveal your name or email. Don't paste secrets,
          file paths or anything else you don't want public into a command.
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={3}>Deleting your data</Title>
        <Text>
          You can delete any of your own results from the device page: open its
          commands and use the delete button. To delete your account and
          everything linked to it, email{" "}
          <Anchor href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Anchor> from
          the address you signed in with. We'll delete it within 30 days.
        </Text>
      </Stack>

      <Stack gap="xs">
        <Title order={3}>Who processes it</Title>
        <Text>
          The site is hosted on GitHub Pages. Accounts and results are stored
          with Supabase, and sign-in emails are sent through Resend. They
          process data only to run the service.
        </Text>
      </Stack>
    </Stack>
  );
}

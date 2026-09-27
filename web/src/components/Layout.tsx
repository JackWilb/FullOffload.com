import {
  ActionIcon,
  Anchor,
  AppShell,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import type { Session } from "@supabase/supabase-js";
import {
  IconChevronDown,
  IconLogout,
  IconMoon,
  IconSun,
  IconTrash,
} from "@tabler/icons-react";
import { Link, Outlet, ScrollRestoration, useLocation } from "react-router";
import { signOut, useAuth } from "../lib/auth";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { Logo } from "./Logo";
import { SignInPanel } from "./SignInPanel";

const SOURCE_URL = "https://github.com/JackWilb/FullOffload.com";

/** Header-only AppShell: logo, "Submit a result", and sign-in or the account menu. */
export function Layout() {
  const { pathname } = useLocation();
  const { session, loading } = useAuth();
  const [signInOpened, signIn] = useDisclosure(false);
  const onSubmitPage = pathname === "/submit";

  return (
    <AppShell header={{ height: 60 }}>
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between" wrap="nowrap" gap="sm">
            <Anchor
              component={Link}
              to="/"
              c="var(--mantine-color-text)"
              underline="never"
              aria-label="Full Offload home"
            >
              <Logo h={22} />
            </Anchor>
            <Group gap="xs" wrap="nowrap">
              {!onSubmitPage && (
                <>
                  <Button
                    component={Link}
                    to="/submit"
                    size="xs"
                    hiddenFrom="sm"
                  >
                    Submit a result
                  </Button>
                  <Button component={Link} to="/submit" visibleFrom="sm">
                    Submit a result
                  </Button>
                </>
              )}
              {session ? (
                <AccountMenu session={session} />
              ) : (
                !loading &&
                !onSubmitPage && (
                  <>
                    <Button
                      variant="default"
                      size="xs"
                      hiddenFrom="sm"
                      onClick={signIn.open}
                    >
                      Sign in
                    </Button>
                    <Button
                      variant="default"
                      visibleFrom="sm"
                      onClick={signIn.open}
                    >
                      Sign in
                    </Button>
                  </>
                )
              )}
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Stack mih="calc(100dvh - 60px)" justify="space-between" gap={0}>
          <Container size="lg" w="100%" py={{ base: "md", sm: "xl" }}>
            <Outlet />
          </Container>
          <Footer />
        </Stack>
      </AppShell.Main>

      <Modal opened={signInOpened && !session} onClose={signIn.close} centered>
        <SignInPanel />
      </Modal>
      <ScrollRestoration />
    </AppShell>
  );
}

function AccountMenu({ session }: { session: Session }) {
  const metadata = session.user.user_metadata as Record<string, unknown>;
  const name =
    [metadata.full_name, metadata.name, metadata.user_name].find(
      (value): value is string => typeof value === "string" && value.length > 0,
    ) ??
    session.user.email ??
    "Account";
  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : undefined;
  const [deleteOpened, deleteAccount] = useDisclosure(false);

  return (
    <>
      <Menu position="bottom-end" width={220}>
        <Menu.Target>
          <UnstyledButton aria-label="Account menu">
            <Group gap={6} wrap="nowrap">
              <Avatar src={avatarUrl} name={name} color="brand" size={28} />
              <Text size="sm" fw={500} visibleFrom="sm" maw={160} truncate>
                {name}
              </Text>
              <IconChevronDown size={14} stroke={1.5} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{session.user.email ?? name}</Menu.Label>
          <Menu.Item
            leftSection={<IconLogout size={16} stroke={1.5} />}
            onClick={() => void signOut()}
          >
            Sign out
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="danger"
            leftSection={<IconTrash size={16} stroke={1.5} />}
            onClick={deleteAccount.open}
          >
            Delete account
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <DeleteAccountModal opened={deleteOpened} onClose={deleteAccount.close} />
    </>
  );
}

function Footer() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme("light");

  return (
    <Box component="footer">
      <Divider />
      <Container size="lg" py="md">
        <Group justify="space-between" wrap="nowrap">
          <Text size="xs" c="dimmed">
            Full Offload ·{" "}
            <Anchor component={Link} to="/privacy" inherit>
              Privacy
            </Anchor>{" "}
            ·{" "}
            <Anchor href={SOURCE_URL} inherit>
              Source on GitHub
            </Anchor>
          </Text>
          <ActionIcon
            variant="default"
            size="lg"
            aria-label="Toggle color scheme"
            onClick={() => setColorScheme(scheme === "dark" ? "light" : "dark")}
          >
            {scheme === "dark" ? (
              <IconSun size={18} stroke={1.5} />
            ) : (
              <IconMoon size={18} stroke={1.5} />
            )}
          </ActionIcon>
        </Group>
      </Container>
    </Box>
  );
}

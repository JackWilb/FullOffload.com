import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useNavigate } from "react-router";
import { errorMessage, useDeleteAccount } from "../lib/api";

/** Confirms deleting the signed-in account and all of its results. */
export function DeleteAccountModal({
  opened,
  onClose,
}: {
  opened: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const deleteAccount = useDeleteAccount();

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Delete your account?"
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          This deletes your sign-in and every result you submitted. It can't be
          undone. Devices you added stay, since other people's results may use
          them.
        </Text>
        {deleteAccount.error && (
          <Alert
            color="danger"
            variant="light"
            title="Couldn't delete your account"
          >
            {errorMessage(deleteAccount.error)}
          </Alert>
        )}
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose}>
            Keep my account
          </Button>
          <Button
            color="danger"
            loading={deleteAccount.isPending}
            onClick={() =>
              // Awaited rather than an onSuccess callback: signing out unmounts the account
              // menu that renders this modal, and callbacks of unmounted components never run.
              void deleteAccount.mutateAsync().then(
                () => navigate("/"),
                () => undefined, // the error is shown from deleteAccount.error
              )
            }
          >
            Delete account
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

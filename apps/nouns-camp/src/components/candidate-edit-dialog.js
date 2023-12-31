import React from "react";
import { diffLines } from "diff";
import { useNavigate } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import {
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import Input from "@shades/ui-web/input";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import DialogFooter from "@shades/ui-web/dialog-footer";
import {
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  resolveAction as resolveActionTransactions,
  buildActions as buildActionsFromTransactions,
} from "../utils/transactions.js";
import { useProposalCandidate } from "../store.js";
import useChainId from "../hooks/chain-id.js";
import {
  useUpdateProposalCandidate,
  useCancelProposalCandidate,
} from "../hooks/data-contract.js";
import ProposalEditor from "./proposal-editor.js";
import { PreviewUpdateDialog } from "./proposal-edit-dialog.js";

const createMarkdownDescription = ({ title, body }) => {
  const markdownBody = messageUtils.toMarkdown(richTextToMessageBlocks(body));
  return `# ${title.trim()}\n\n${markdownBody}`;
};

const CandidateEditDialog = ({ candidateId, dismiss }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const chainId = useChainId();
  const scrollContainerRef = React.useRef();

  const candidate = useProposalCandidate(candidateId);

  const persistedTitle = candidate.latestVersion.content.title;
  const persistedMarkdownBody = candidate.latestVersion.content.body;
  const persistedDescription = candidate.latestVersion.content.description;

  const persistedRichTextBody = React.useMemo(() => {
    const messageBlocks = markdownUtils.toMessageBlocks(persistedMarkdownBody);
    return messageToRichTextBlocks(messageBlocks);
  }, [persistedMarkdownBody]);

  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);

  const [title, setTitle] = React.useState(persistedTitle);
  const [body, setBody] = React.useState(persistedRichTextBody);
  const [actions, setActions] = React.useState(() =>
    buildActionsFromTransactions(candidate.latestVersion.content.transactions, {
      chainId,
    })
  );

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const deferredBody = React.useDeferredValue(body);

  const hasTitleChanges = title.trim() !== persistedTitle;

  const hasBodyChanges = React.useMemo(() => {
    const markdownBody = messageUtils.toMarkdown(
      richTextToMessageBlocks(deferredBody)
    );
    return markdownBody !== persistedMarkdownBody;
  }, [deferredBody, persistedMarkdownBody]);

  const hasActionChanges = false;

  const hasChanges = hasTitleChanges || hasBodyChanges || hasActionChanges;

  const updateProposalCandidate = useUpdateProposalCandidate(candidate.slug);
  const cancelProposalCandidate = useCancelProposalCandidate(candidate.slug);

  const diff = React.useMemo(
    () =>
      diffLines(
        persistedDescription,
        createMarkdownDescription({ title, body: deferredBody })
      ),
    [title, deferredBody, persistedDescription]
  );

  const submit = async ({ updateMessage }) => {
    try {
      setPendingSubmit(true);

      const description = createMarkdownDescription({ title, body });
      const transactions = actions.flatMap((a) =>
        resolveActionTransactions(a, { chainId })
      );

      await updateProposalCandidate({
        description,
        transactions,
        updateMessage,
      });
      dismiss();
    } catch (e) {
      console.log(e);
      alert("Something went wrong");
    } finally {
      setPendingSubmit(false);
    }
  };

  // React.useEffect(() => {
  //   const messageBlocks = markdownUtils.toMessageBlocks(persistedMarkdownBody);
  //   setBody(messageToRichTextBlocks(messageBlocks));
  // }, [persistedTitle, persistedMarkdownBody]);

  return (
    <>
      <div
        ref={scrollContainerRef}
        css={css({
          overflow: "auto",
          padding: "3.2rem 0 0",
          "@media (min-width: 600px)": {
            padding: "0",
          },
        })}
      >
        <ProposalEditor
          title={title}
          body={body}
          actions={actions}
          setTitle={setTitle}
          setBody={setBody}
          setActions={setActions}
          onSubmit={() => {
            setShowPreviewDialog(true);
          }}
          onDelete={() => {
            if (!confirm("Are you sure you wish to cancel this candidate?"))
              return;

            cancelProposalCandidate().then(() => {
              navigate("/", { replace: true });
            });
          }}
          containerHeight="calc(100vh - 6rem)"
          scrollContainerRef={scrollContainerRef}
          submitLabel="Preview update"
          submitDisabled={!hasChanges}
          background={theme.colors.dialogBackground}
        />
      </div>

      {showPreviewDialog && (
        <PreviewUpdateDialog
          isOpen
          close={() => {
            setShowPreviewDialog(false);
          }}
          diff={diff}
          submit={() => {
            setShowPreviewDialog(false);
            setShowSubmitDialog(true);
          }}
        />
      )}

      {showSubmitDialog && (
        <SubmitUpdateDialog
          isOpen
          close={() => {
            setShowSubmitDialog(false);
          }}
          hasPendingSubmit={hasPendingSubmit}
          submit={submit}
        />
      )}
    </>
  );
};

const SubmitUpdateDialog = ({ isOpen, hasPendingSubmit, submit, close }) => {
  const [updateMessage, setUpdateMessage] = React.useState("");

  const hasMessage = updateMessage.trim() !== "";

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="54rem"
      css={css({ overflow: "auto" })}
    >
      {({ titleProps }) => (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit({ updateMessage });
          }}
          css={css({
            overflow: "auto",
            padding: "1.5rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })}
        >
          <DialogHeader
            title="Submit"
            titleProps={titleProps}
            dismiss={close}
          />
          <main>
            <Input
              multiline
              label="Update message"
              rows={3}
              placeholder="..."
              value={updateMessage}
              onChange={(e) => {
                setUpdateMessage(e.target.value);
              }}
            />
          </main>
          <DialogFooter
            cancel={close}
            cancelButtonLabel="Cancel"
            submitButtonLabel="Submit update"
            submitButtonProps={{
              isLoading: hasPendingSubmit,
              disabled: !hasMessage || hasPendingSubmit,
            }}
          />
        </form>
      )}
    </Dialog>
  );
};

export default CandidateEditDialog;
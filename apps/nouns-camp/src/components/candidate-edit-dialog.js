import React from "react";
import { css, useTheme } from "@emotion/react";
import {
  markdown as markdownUtils,
  message as messageUtils,
} from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import {
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  unparse as unparseTransactions,
  resolveAction as resolveActionTransactions,
  buildActions as buildActionsFromTransactions,
  isEqual as areTransactionsEqual,
  stringify as stringifyTransaction,
} from "../utils/transactions.js";
import { diffParagraphs } from "../utils/diff.js";
import { useProposalCandidate } from "../store.js";
import { useUpdateProposalCandidate } from "../hooks/data-contract.js";
import ProposalEditor from "./proposal-editor.js";
import {
  PreviewUpdateDialog,
  SubmitUpdateDialog,
  createMarkdownDescription,
} from "./proposal-edit-dialog.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/drafts.js";

const CandidateEditDialog = ({ candidateId, isOpen, close: closeDialog }) => {
  const theme = useTheme();
  const scrollContainerRef = React.useRef();

  const candidate = useProposalCandidate(candidateId);

  const persistedTitle = candidate.latestVersion.content.title;
  const persistedMarkdownBody = candidate.latestVersion.content.body;
  const persistedDescription = candidate.latestVersion.content.description;

  const persistedRichTextBody = React.useMemo(() => {
    const messageBlocks = markdownUtils.toMessageBlocks(persistedMarkdownBody);
    return messageToRichTextBlocks(messageBlocks);
  }, [persistedMarkdownBody]);

  const persistedActions = React.useMemo(
    () =>
      buildActionsFromTransactions(
        candidate.latestVersion.content.transactions,
      ),
    [candidate],
  );

  const draftId = `candidate:${candidateId}`;

  const { createItem: createDraft, deleteItem: deleteDraft } = useDrafts();
  const [
    draft,
    {
      setName: setDraftTitle,
      setBody: setDraftBody,
      setActions: setDraftActions,
    },
  ] = useDraft(draftId);

  const [showPreviewDialog, setShowPreviewDialog] = React.useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = React.useState(false);

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);
  const [hasPendingDismiss, setPendingDismiss] = React.useState(false);

  const deferredBody = React.useDeferredValue(
    draft?.body ?? persistedRichTextBody,
  );

  const hasChanges = React.useMemo(() => {
    if (!draft) return;

    const hasTitleChanges = draft.name.trim() !== persistedTitle;

    if (hasTitleChanges) return true;

    const transactions = unparseTransactions(
      draft.actions.flatMap((a) => resolveActionTransactions(a)),
    );

    const persistedTransactions = {
      targets: candidate.latestVersion.content.targets,
      signatures: candidate.latestVersion.content.signatures,
      calldatas: candidate.latestVersion.content.calldatas,
      values: candidate.latestVersion.content.values,
    };

    const hasActionChanges = !areTransactionsEqual(
      transactions,
      persistedTransactions,
    );

    if (hasActionChanges) return true;

    const markdownBody = messageUtils.toMarkdown(
      richTextToMessageBlocks(deferredBody),
    );

    const hasBodyChanges = markdownBody !== persistedMarkdownBody;

    return hasBodyChanges;
  }, [candidate, draft, persistedTitle, deferredBody, persistedMarkdownBody]);

  const dismissDialog = () => {
    setPendingDismiss(true);
    if (!hasChanges) {
      deleteDraft(draftId);
      closeDialog();
      return;
    }

    if (
      !confirm(
        "This will discard all your changes. Are you sure you wish to continue?",
      )
    ) {
      setPendingDismiss(false);
      return;
    }

    deleteDraft(draftId);
    closeDialog();
  };

  const updateProposalCandidate = useUpdateProposalCandidate(candidate.slug);

  const createDescriptionDiff = () =>
    diffParagraphs(
      persistedDescription,
      createMarkdownDescription({ title: draft.name, body: deferredBody }),
    );
  const createTransactionsDiff = () =>
    diffParagraphs(
      candidate.latestVersion.content.transactions
        .map((t) => stringifyTransaction(t))
        .join("\n\n"),
      draft.actions
        .flatMap((a) => resolveActionTransactions(a))
        .map((t) => stringifyTransaction(t))
        .join("\n\n"),
    );

  const submit = async ({ updateMessage }) => {
    try {
      setPendingSubmit(true);

      const description = createMarkdownDescription({
        title: draft.name,
        body: draft.body,
      });
      const transactions = draft.actions.flatMap((a) =>
        resolveActionTransactions(a),
      );

      await updateProposalCandidate({
        description,
        transactions,
        targetProposalId: candidate.latestVersion.targetProposalId,
        updateMessage,
      });
      closeDialog();
    } catch (e) {
      console.log(e);
      alert("Something went wrong");
    } finally {
      setPendingSubmit(false);
    }
  };

  React.useEffect(() => {
    // if the store is not initialized or dialog is being dismissed, ignore
    // draft creation
    if (!createDraft || draft != null || hasPendingDismiss) return;

    createDraft({
      id: draftId,
      name: persistedTitle,
      body: persistedRichTextBody,
      actions: persistedActions,
      type: "edit",
    });
  }, [
    draftId,
    draft,
    createDraft,
    persistedTitle,
    persistedRichTextBody,
    persistedActions,
    hasPendingDismiss,
  ]);

  // always have a draft before trying to edit
  if (!draft) return null;

  return (
    <Dialog
      isOpen={isOpen}
      tray
      onRequestClose={dismissDialog}
      width="135.6rem"
    >
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
          title={draft.name}
          body={draft.body}
          actions={draft.actions}
          setTitle={setDraftTitle}
          setBody={setDraftBody}
          setActions={setDraftActions}
          proposerId={candidate.proposerId}
          onSubmit={() => {
            setShowPreviewDialog(true);
          }}
          submitLabel="Preview update"
          submitDisabled={!hasChanges}
          hasPendingSubmit={hasPendingSubmit}
          containerHeight="calc(100vh - 6rem)"
          scrollContainerRef={scrollContainerRef}
          background={theme.colors.dialogBackground}
          note="All edits saved to browser storage"
        />
      </div>

      {showPreviewDialog && (
        <PreviewUpdateDialog
          isOpen
          close={() => {
            setShowPreviewDialog(false);
          }}
          createDescriptionDiff={createDescriptionDiff}
          createTransactionsDiff={createTransactionsDiff}
          submitLabel="Continue to submission"
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
    </Dialog>
  );
};

export default CandidateEditDialog;

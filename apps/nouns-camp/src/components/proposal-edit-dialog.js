import React from "react";
import { css, useTheme } from "@emotion/react";
import {
  markdown as markdownUtils,
  message as messageUtils,
  function as functionUtils,
} from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import Link from "@shades/ui-web/link";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import DialogFooter from "@shades/ui-web/dialog-footer";
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
import {
  useActions,
  useProposal,
  useAccountProposalCandidates,
} from "../store.js";
import { useWallet } from "../hooks/wallet.js";
import { useNavigate } from "../hooks/navigation.js";
import { useUpdateProposal } from "../hooks/dao-contract.js";
import { useCreateProposalCandidate } from "../hooks/data-contract.js";
import DiffBlock from "./diff-block.js";
import ProposalEditor from "./proposal-editor.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/drafts.js";

export const createMarkdownDescription = ({ title, body }) => {
  const markdownBody = messageUtils.toMarkdown(richTextToMessageBlocks(body));
  return `# ${title.trim()}\n\n${markdownBody}`;
};

const ProposalEditDialog = ({ proposalId, isOpen, close: closeDialog }) => {
  const theme = useTheme();
  const navigate = useNavigate();

  const { address: connectedAccountAddress } = useWallet();

  const scrollContainerRef = React.useRef();

  const { fetchProposalCandidate, fetchProposalCandidatesByAccount } =
    useActions();

  const proposal = useProposal(proposalId);

  const persistedTitle = proposal.title;
  const persistedMarkdownBody = proposal.body;

  const persistedRichTextBody = React.useMemo(() => {
    const messageBlocks = markdownUtils.toMessageBlocks(persistedMarkdownBody);
    return messageToRichTextBlocks(messageBlocks);
  }, [persistedMarkdownBody]);

  const persistedActions = React.useMemo(
    () => buildActionsFromTransactions(proposal.transactions ?? []),
    [proposal],
  );

  const draftId = `proposal:${proposalId}`;

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

  const hasTitleChanges = React.useMemo(() => {
    if (!draft) return;
    return draft?.name.trim() !== persistedTitle;
  }, [draft, persistedTitle]);

  const hasBodyChanges = React.useMemo(() => {
    if (!draft) return;
    const markdownBody = messageUtils.toMarkdown(
      richTextToMessageBlocks(deferredBody),
    );
    return markdownBody !== persistedMarkdownBody;
  }, [draft, deferredBody, persistedMarkdownBody]);

  const hasActionChanges = React.useMemo(() => {
    if (!draft) return;

    return (
      draft.actions.length !== persistedActions.length ||
      draft.actions.some((a, i) => {
        const persistedAction = persistedActions[i];

        const transactions = unparseTransactions(resolveActionTransactions(a));
        const persistedTransactions = unparseTransactions(
          resolveActionTransactions(persistedAction),
        );

        return !areTransactionsEqual(transactions, persistedTransactions);
      })
    );
  }, [draft, persistedActions]);

  const hasChanges = hasTitleChanges || hasBodyChanges || hasActionChanges;

  const createDescriptionDiff = () =>
    diffParagraphs(
      proposal.description,
      createMarkdownDescription({ title: draft.name, body: deferredBody }),
    );
  const createTransactionsDiff = () =>
    diffParagraphs(
      (proposal.transactions ?? [])
        .map((t) => stringifyTransaction(t))
        .join("\n\n"),
      draft.actions
        .flatMap((a) => resolveActionTransactions(a))
        .map((t) => stringifyTransaction(t))
        .join("\n\n"),
    );

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

  // const usdcSumValue = actions.reduce((sum, a) => {
  //   switch (a.type) {
  //     case "one-time-payment":
  //     case "streaming-payment":
  //       return a.currency !== "usdc" ? sum : sum + parseUnits(a.amount, 6);

  //     default:
  //       return sum;
  //   }
  // }, BigInt(0));

  // const payerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);
  //
  useFetch(
    connectedAccountAddress == null
      ? null
      : () => fetchProposalCandidatesByAccount(connectedAccountAddress),
    [connectedAccountAddress],
  );

  const accountProposalCandidates = useAccountProposalCandidates(
    connectedAccountAddress,
  );

  const updateProposal = useUpdateProposal(proposalId);
  const createCandidate = useCreateProposalCandidate();

  const isSponsoredUpdate = proposal.signers.length > 0;

  const submit = async ({ updateMessage } = {}) => {
    const buildUpdateCandidateSlug = () => {
      const slugifiedTitle =
        draft.name.toLowerCase().replace(/\s+/g, "-") + "-update";
      let index = 0;
      while (slugifiedTitle) {
        const slug = [slugifiedTitle, index].filter(Boolean).join("-");
        if (accountProposalCandidates.find((c) => c.slug === slug) == null)
          return slug;
        index += 1;
      }
    };

    const getDescriptionIfChanged = () => {
      if (!hasTitleChanges && !hasBodyChanges) return null;
      return createMarkdownDescription({ title: draft.name, body: draft.body });
    };

    const getTransactionsIfChanged = () => {
      if (!hasActionChanges) return null;
      return draft.actions.flatMap((a) => resolveActionTransactions(a));
    };

    try {
      setPendingSubmit(true);

      if (isSponsoredUpdate) {
        const { slug: createdCandidateSlug } = await createCandidate({
          targetProposalId: proposalId,
          slug: buildUpdateCandidateSlug(),
          description: createMarkdownDescription({
            title: draft.name,
            body: draft.body,
          }),
          transactions: draft.actions.flatMap((a) =>
            resolveActionTransactions(a),
          ),
        });
        const candidateId = [
          connectedAccountAddress,
          encodeURIComponent(createdCandidateSlug),
        ].join("-");

        await functionUtils.retryAsync(
          () => fetchProposalCandidate(candidateId),
          { retries: 100 },
        );

        navigate(`/candidates/${candidateId}`, { replace: true });
      } else {
        await updateProposal({
          description: getDescriptionIfChanged(),
          transactions: getTransactionsIfChanged(),
          updateMessage,
        });
        closeDialog();
      }
    } catch (e) {
      console.error(e);
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
          proposerId={proposal.proposerId}
          onSubmit={() => {
            setShowPreviewDialog(true);
          }}
          submitLabel="Preview update"
          submitDisabled={!hasChanges}
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
          submitDisabled={isSponsoredUpdate && createCandidate == null}
          submitLabel={
            isSponsoredUpdate
              ? "Create update candidate"
              : "Continue to submission"
          }
          submit={async () => {
            if (isSponsoredUpdate) {
              await submit();
              return;
            }
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

export const SubmitUpdateDialog = ({
  isOpen,
  hasPendingSubmit,
  submit,
  close,
}) => {
  const [updateMessage, setUpdateMessage] = React.useState("");

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
          <DialogHeader title="Submit" titleProps={titleProps} />
          <main>
            <Input
              multiline
              label="Update comment (optional)"
              rows={3}
              placeholder="..."
              value={updateMessage}
              onChange={(e) => {
                setUpdateMessage(e.target.value);
              }}
              disabled={hasPendingSubmit}
            />
          </main>
          <DialogFooter
            cancel={close}
            cancelButtonLabel="Cancel"
            submitButtonLabel="Submit update"
            submitButtonProps={{
              isLoading: hasPendingSubmit,
              disabled: hasPendingSubmit,
            }}
          />
        </form>
      )}
    </Dialog>
  );
};

export const PreviewUpdateDialog = ({
  isOpen,
  createDescriptionDiff,
  createTransactionsDiff,
  submitLabel,
  submitDisabled,
  submit,
  close,
}) => {
  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const descriptionDiff = createDescriptionDiff();
  const transactionsDiff = createTransactionsDiff();
  const hasDescriptionChanges = descriptionDiff.some(
    (token) => token.added || token.removed,
  );
  const hasTransactionChanges = transactionsDiff.some(
    (token) => token.added || token.removed,
  );

  const hasVisibleDiff = hasDescriptionChanges || hasTransactionChanges;

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="74rem"
      css={css({ overflow: "auto" })}
    >
      {({ titleProps }) => (
        <div
          css={css({
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          })}
        >
          <DialogHeader
            title="Update preview"
            subtitle={
              <>
                Diff formatted as{" "}
                <Link
                  component="a"
                  href="https://daringfireball.net/projects/markdown/syntax"
                  rel="noreferrer"
                  target="_blank"
                >
                  Markdown
                </Link>
              </>
            }
            titleProps={titleProps}
            css={css({
              padding: "1.5rem 1.5rem 0",
              "@media (min-width: 600px)": {
                padding: "2rem 2rem 0",
              },
            })}
          />
          <main
            css={(t) =>
              css({
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                fontSize: t.text.sizes.small,
                padding: "0 1.5rem",
                "@media (min-width: 600px)": {
                  fontSize: t.text.sizes.base,
                  padding: "0 2rem",
                },
                "[data-diff]": {
                  margin: "0 -1.5rem",
                  "@media (min-width: 600px)": {
                    margin: "0 -2rem",
                  },
                },
                h2: {
                  fontSize: t.text.sizes.header,
                  fontWeight: t.text.weights.header,
                  margin: "0 0 1.6rem",
                },
                "* + h2": {
                  marginTop: "6.4rem",
                },
              })
            }
          >
            {!hasVisibleDiff ? (
              <>
                <h2>Content</h2>
                <DiffBlock diff={descriptionDiff} data-diff />
              </>
            ) : (
              <>
                <h2>Content</h2>
                <DiffBlock diff={descriptionDiff} data-diff />

                {hasTransactionChanges && (
                  <>
                    <h2>Actions</h2>
                    <DiffBlock diff={transactionsDiff} data-diff />
                  </>
                )}
              </>
            )}
          </main>
          <footer
            css={css({
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1.5rem",
              padding: "0 1.5rem 1.5rem",
              "@media (min-width: 600px)": {
                marginTop: "2rem",
                padding: "0 2rem 2rem",
              },
            })}
          >
            <div css={css({ display: "flex", gap: "1rem" })}>
              <Button size="medium" onClick={close}>
                Cancel
              </Button>
              <Button
                size="medium"
                variant="primary"
                disabled={submitDisabled || hasPendingSubmit}
                isLoading={hasPendingSubmit}
                onClick={async () => {
                  try {
                    setPendingSubmit(true);
                    await submit();
                  } finally {
                    setPendingSubmit(false);
                  }
                }}
              >
                {submitLabel}
              </Button>
            </div>
          </footer>
        </div>
      )}
    </Dialog>
  );
};

export default ProposalEditDialog;

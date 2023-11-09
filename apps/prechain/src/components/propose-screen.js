import getDateYear from "date-fns/getYear";
import React from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { css, Global as GlobalStyles } from "@emotion/react";
import {
  useFetch,
  useLatestCallback,
  AutoAdjustingHeightTextarea,
} from "@shades/common/react";
import {
  message as messageUtils,
  markdown as markdownUtils,
  isTouchDevice,
} from "@shades/common/utils";
import { useAccountDisplayName } from "@shades/common/app";
import {
  Plus as PlusIcon,
  TrashCan as TrashCanIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import RichTextEditor, {
  Provider as EditorProvider,
  Toolbar as EditorToolbar,
  isNodeEmpty as isRichTextEditorNodeEmpty,
  isSelectionCollapsed,
  toMessageBlocks as richTextToMessageBlocks,
  fromMessageBlocks as messageToRichTextBlocks,
} from "@shades/ui-web/rich-text-editor";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/channel-drafts.js";
import {
  useCreateProposal,
  useCanCreateProposal,
} from "../hooks/dao-contract.js";
import { useActions, useAccountProposalCandidates } from "../store.js";
import { useTokenBuyerEthNeeded } from "../hooks/misc-contracts.js";
import { useCreateProposalCandidate } from "../hooks/data-contract.js";
import useKeyboardShortcuts from "../hooks/keyboard-shortcuts.js";
import Layout, { MainContentContainer } from "./layout.js";
import FormattedDate from "./formatted-date.js";
import FormattedNumber from "./formatted-number.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import { TransactionExplanation } from "./transaction-list.js";
import ActionDialog from "./action-dialog.js";
import { Overlay } from "react-aria";

const isDebugSession =
  new URLSearchParams(location.search).get("debug") != null;

const decimalsByCurrency = {
  eth: 18,
  weth: 18,
  usdc: 6,
};

const retryPromise = (fn, { retries = 3, timeout = 1000 } = {}) =>
  new Promise((resolve, reject) => {
    fn().then(resolve, (e) => {
      if (retries < 1) return reject(e);
      setTimeout(() => {
        retryPromise(fn, { retries: retries - 1, timeout }).then(
          resolve,
          reject
        );
      }, timeout);
    });
  });

const getActionTransactions = (a) => {
  switch (a.type) {
    case "one-time-payment": {
      switch (a.currency) {
        case "eth":
          return [
            {
              type: "transfer",
              target: a.target,
              value: parseEther(String(a.amount)),
            },
          ];

        case "usdc":
          return [
            {
              type: "usdc-transfer-via-payer",
              receiverAddress: a.target,
              usdcAmount: parseUnits(String(a.amount), 6),
            },
          ];

        default:
          throw new Error();
      }
    }

    case "streaming-payment": {
      const formattedAmount = String(a.amount);

      const createStreamTransaction = {
        type: "stream",
        receiverAddress: a.target,
        token: a.currency.toUpperCase(),
        tokenAmount: parseUnits(
          formattedAmount,
          decimalsByCurrency[a.currency]
        ),
        startDate: new Date(a.startTimestamp),
        endDate: new Date(a.endTimestamp),
        streamContractAddress: a.predictedStreamContractAddress,
      };

      switch (a.currency) {
        case "weth":
          return [
            createStreamTransaction,
            {
              type: "weth-deposit",
              value: parseUnits(formattedAmount, decimalsByCurrency.eth),
            },
            {
              type: "weth-transfer",
              receiverAddress: a.predictedStreamContractAddress,
              wethAmount: parseUnits(formattedAmount, decimalsByCurrency.weth),
            },
          ];

        case "usdc":
          return [
            createStreamTransaction,
            {
              type: "usdc-transfer-via-payer",
              receiverAddress: a.predictedStreamContractAddress,
              usdcAmount: parseUnits(formattedAmount, decimalsByCurrency.usdc),
            },
          ];

        default:
          throw new Error();
      }
    }

    case "custom-transaction":
      return [
        {
          type: "unparsed-function-call",
          target: a.contractAddress,
          signature: "",
          calldata: "0x",
          value: "0",
        },
      ];

    default:
      throw new Error();
  }
};

const useEditorMode = (draft, { setBody }) => {
  const mode = typeof draft.body === "string" ? "markdown" : "rich-text";

  const setMode = (newMode) => {
    if (mode === newMode) return;

    const transform = [mode, newMode].join(" -> ");

    switch (transform) {
      case "markdown -> rich-text": {
        const messageBlocks = markdownUtils.toMessageBlocks(draft.body);
        setBody(messageToRichTextBlocks(messageBlocks));
        break;
      }

      case "rich-text -> markdown":
        setBody(messageUtils.toMarkdown(richTextToMessageBlocks(draft.body)));
        break;

      default:
        throw new Error(`unknown transform: "${transform}"`);
    }
  };

  return [mode, setMode];
};

const ProposeScreen = () => {
  const { draftId } = useParams();
  const navigate = useNavigate();

  const editorRef = React.useRef();
  const editor = editorRef.current;

  const scrollContainerRef = React.useRef();

  const [isEditorFocused, setEditorFocused] = React.useState(false);
  const [editorSelection, setEditorSelection] = React.useState(null);

  const [hasFloatingToolbarFocus, setHasFloatingToolbarFocus] =
    React.useState(false);

  const isFloatingToolbarVisible =
    !isTouchDevice() &&
    editor != null &&
    (hasFloatingToolbarFocus ||
      (isEditorFocused &&
        editorSelection != null &&
        !isSelectionCollapsed(editorSelection) &&
        editor.string(editorSelection) !== ""));

  const { address: connectedAccountAddress } = useAccount();
  const {
    fetchProposal,
    fetchProposalCandidate,
    fetchProposalCandidatesByAccount,
  } = useActions();

  const canCreateProposal = useCanCreateProposal();

  const [draftTargetType, setDraftTargetType] = React.useState("candidate");

  const { deleteItem: deleteDraft } = useDrafts();
  const [draft, { setName, setBody, setActions }] = useDraft(draftId);

  const [hasPendingRequest, setPendingRequest] = React.useState(false);
  const [selectedActionIndex, setSelectedActionIndex] = React.useState(null);
  const [showNewActionDialog, setShowNewActionDialog] = React.useState(false);

  const [editorMode, setEditorMode] = useEditorMode(draft, { setBody });

  const accountProposalCandidates = useAccountProposalCandidates(
    connectedAccountAddress
  );

  useFetch(
    () => fetchProposalCandidatesByAccount(connectedAccountAddress),
    [connectedAccountAddress]
  );

  const isNameEmpty = draft.name.trim() === "";
  const isBodyEmpty =
    typeof draft.body === "string"
      ? draft.body.trim() === ""
      : draft.body.every(isRichTextEditorNodeEmpty);

  const hasRequiredInput = !isNameEmpty && !isBodyEmpty;

  const selectedAction =
    selectedActionIndex >= 0 ? draft.actions[selectedActionIndex] : null;

  const createProposalCandidate = useCreateProposalCandidate({
    enabled: hasRequiredInput && draftTargetType === "candidate",
  });

  const createProposal = useCreateProposal({
    enabled:
      hasRequiredInput && canCreateProposal && draftTargetType === "candidate",
  });

  const usdcSumValue = draft.actions.reduce((sum, a) => {
    switch (a.type) {
      case "one-time-payment":
      case "streaming-payment":
        return a.currency !== "usdc"
          ? sum
          : sum + parseUnits(String(a.amount), 6);

      default:
        return sum;
    }
  }, BigInt(0));

  const tokenBuyerTopUpValue = useTokenBuyerEthNeeded(usdcSumValue);

  const submit = async () => {
    setPendingRequest(true);

    const bodyMarkdown =
      typeof draft.body === "string"
        ? draft.body
        : messageUtils.toMarkdown(richTextToMessageBlocks(draft.body));

    const description = `# ${draft.name.trim()}\n\n${bodyMarkdown}`;

    const transactions = draft.actions.flatMap((a) => {
      const actionTransactions = getActionTransactions(a);

      if (tokenBuyerTopUpValue > 0)
        return [
          ...actionTransactions,
          {
            type: "token-buyer-top-up",
            value: tokenBuyerTopUpValue,
          },
        ];

      return actionTransactions;
    });

    const buildCandidateSlug = (title) => {
      const slugifiedTitle = title.toLowerCase().replace(/\s+/g, "-");
      let index = 0;
      while (slugifiedTitle) {
        const slug = [slugifiedTitle, index].filter(Boolean).join("-");
        if (accountProposalCandidates.find((c) => c.slug === slug) == null)
          return slug;
        index += 1;
      }
    };

    const candidateSlug = buildCandidateSlug(draft.name.trim());

    return Promise.resolve()
      .then(() =>
        draftTargetType === "candidate"
          ? createProposalCandidate({
              slug: candidateSlug,
              description,
              transactions,
            }).then(async (candidate) => {
              const candidateId = [
                connectedAccountAddress,
                encodeURIComponent(candidate.slug),
              ].join("-");

              await retryPromise(() => fetchProposalCandidate(candidateId), {
                retries: 100,
              });

              navigate(`/candidates/${candidateId}`, { replace: true });
            })
          : createProposal({ description, transactions }).then(
              async (proposal) => {
                await retryPromise(() => fetchProposal(proposal.id), {
                  retries: 100,
                });

                navigate(`/${proposal.id}`, { replace: true });
              }
            )
      )
      .then(() => {
        deleteDraft(draftId);
      })
      .catch((e) => {
        alert("Ops, looks like something went wrong!");
        return Promise.reject(e);
      })
      .finally(() => {
        setPendingRequest(false);
      });
  };

  const hasActions = draft.actions != null && draft.actions.length > 0;

  useKeyboardShortcuts({
    "$mod+Shift+m": (e) => {
      if (!isDebugSession) return;
      e.preventDefault();
      setEditorMode(editorMode === "rich-text" ? "markdown" : "rich-text");
    },
  });

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/?tab=proposals", label: "Drafts", desktopOnly: true },
          { to: `/new/${draftId}`, label: draft?.name || "Untitled draft" },
        ]}
        // actions={isProposer ? [{ onSelect: openDialog, label: "Edit" }] : []}
      >
        <EditorProvider>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            css={css({ padding: "0 1.6rem" })}
          >
            <MainContentContainer
              sidebar={
                <div
                  css={(t) =>
                    css({
                      "@media (min-width: 952px)": {
                        display: "flex",
                        flexDirection: "column",
                        height: `calc(100vh - ${t.navBarHeight})`,
                      },
                    })
                  }
                >
                  <div
                    css={css({
                      flex: 1,
                      minHeight: 0,
                      padding: "0 0 3.2rem",
                      "@media (min-width: 600px)": {
                        padding: "3.2rem 0",
                      },
                      "@media (min-width: 952px)": {
                        padding: "6rem 0 12rem",
                      },
                    })}
                  >
                    {hasActions && (
                      <h2
                        css={(t) =>
                          css({
                            textTransform: "uppercase",
                            fontSize: t.text.sizes.small,
                            fontWeight: t.text.weights.emphasis,
                            color: t.colors.textMuted,
                            margin: "0 0 1.4rem",
                          })
                        }
                      >
                        Actions
                      </h2>
                    )}
                    {draft.actions?.length > 0 && (
                      <ol
                        css={(t) =>
                          css({
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            "li + li": { marginTop: "1.6rem" },
                            "li > button": {
                              padding: "1.4rem 1.6rem",
                              borderRadius: "0.3rem",
                              display: "block",
                              width: "100%",
                              border: "0.1rem solid",
                              borderColor: t.colors.borderLight,
                              outline: "none",
                              ":focus-visible": { boxShadow: t.shadows.focus },
                              a: { color: t.colors.textDimmed },
                              em: {
                                fontStyle: "normal",
                                fontWeight: t.text.weights.emphasis,
                                color: t.colors.textDimmed,
                              },
                              "@media(hover: hover)": {
                                cursor: "pointer",
                                ":hover": {
                                  background: t.colors.backgroundModifierHover,
                                },
                              },
                            },
                          })
                        }
                      >
                        {draft.actions
                          .filter((a) => a.type != null)
                          .map((a, i) => {
                            return (
                              <li key={i}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedActionIndex(i);
                                    // setTransactions(
                                    //   draft.transactions.filter(
                                    //     (_, index) => index !== i
                                    //   )
                                    // );
                                  }}
                                >
                                  <ActionExplanation action={a} />
                                </button>
                              </li>
                            );
                          })}
                      </ol>
                    )}

                    <div
                      style={{ marginTop: hasActions ? "1.6rem" : undefined }}
                    >
                      <Button
                        type="button"
                        size={hasActions ? "default" : "large"}
                        icon={
                          hasActions ? (
                            <PlusIcon style={{ width: "0.9rem" }} />
                          ) : undefined
                        }
                        onClick={() => {
                          setShowNewActionDialog(true);
                        }}
                        fullWidth={!hasActions}
                        style={{ height: hasActions ? undefined : "5.25rem" }}
                      >
                        {hasActions ? "Add action" : "Add a proposal action"}
                      </Button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "1.6rem 0",
                      display: "flex",
                      gap: "1rem",
                    }}
                  >
                    <Button
                      danger
                      size="medium"
                      type="button"
                      onClick={() => {
                        if (
                          !confirm(
                            "Are you sure you wish to discard this proposal?"
                          )
                        )
                          return;

                        deleteDraft(draftId).then(() => {
                          navigate("/", { replace: true });
                        });
                      }}
                      icon={<TrashCanIcon style={{ width: "1.4rem" }} />}
                    />
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        gap: "1rem",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Select
                        aria-label="Draft type"
                        value={draftTargetType}
                        options={[
                          { value: "candidate", label: "Create as candidate" },
                          {
                            value: "proposal",
                            label: "Create as proposal",
                            disabled: !canCreateProposal,
                          },
                        ]}
                        onChange={(value) => {
                          setDraftTargetType(value);
                        }}
                        size="medium"
                        align="center"
                        width="max-content"
                        fullWidth={false}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="medium"
                        isLoading={hasPendingRequest}
                        disabled={!hasRequiredInput || hasPendingRequest}
                      >
                        Submit
                      </Button>
                    </div>
                  </div>
                </div>
              }
            >
              <div style={{ position: "relative" }}>
                <div
                  css={(t) =>
                    css({
                      display: "flex",
                      flexDirection: "column",
                      "@media (min-width: 600px)": {
                        padding: "6rem 0 0",
                      },
                      "@media (min-width: 952px)": {
                        minHeight: `calc(100vh - ${t.navBarHeight} - 6.4rem)`, // 6.4rem is the fixed toolbar container height
                        padding: "6rem 0 16rem",
                      },
                    })
                  }
                >
                  <AutoAdjustingHeightTextarea
                    aria-label="Title"
                    rows={1}
                    value={draft.name}
                    onKeyDown={(e) => {
                      if (editorMode !== "rich-text") {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          return;
                        }

                        return;
                      }

                      const editor = editorRef.current;

                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        editor.focus(editor.start([]));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const textBeforeSelection = e.target.value.slice(
                          0,
                          e.target.selectionStart
                        );
                        const textAfterSelection = e.target.value.slice(
                          e.target.selectionEnd
                        );
                        setName(textBeforeSelection);
                        editor.insertNode(
                          {
                            type: "paragraph",
                            children: [{ text: textAfterSelection }],
                          },
                          { at: editor.start([]) }
                        );
                        editor.focus(editor.start([]));
                      }
                    }}
                    onChange={(e) => {
                      setName(e.target.value);
                    }}
                    autoFocus
                    disabled={hasPendingRequest}
                    placeholder="Untitled proposal"
                    css={(t) =>
                      css({
                        background: "none",
                        fontSize: t.text.sizes.huge,
                        lineHeight: 1.15,
                        width: "100%",
                        outline: "none",
                        fontWeight: t.text.weights.header,
                        border: 0,
                        padding: 0,
                        color: t.colors.textNormal,
                        margin: "0 0 0.3rem",
                        "::placeholder": { color: t.colors.textMuted },
                      })
                    }
                  />
                  <div
                    css={(t) =>
                      css({
                        color: t.colors.textDimmed,
                        fontSize: t.text.sizes.base,
                        marginBottom: "2.4rem",
                      })
                    }
                  >
                    By{" "}
                    <AccountPreviewPopoverTrigger
                      // showAvatar
                      accountAddress={connectedAccountAddress}
                    />
                  </div>
                  {editorMode === "rich-text" ? (
                    <RichTextEditor
                      ref={editorRef}
                      value={draft.body}
                      onChange={(e, editor) => {
                        setBody(e);
                        setEditorFocused(editor.isFocused());
                        setEditorSelection(editor.selection);
                      }}
                      onFocus={(_, editor) => {
                        setEditorFocused(true);
                        setEditorSelection(editor.selection);
                      }}
                      onBlur={() => {
                        editorRef.current.removeEmptyParagraphs();
                        setEditorFocused(false);
                      }}
                      placeholder={`Use markdown shortcuts like "# " and "1. " to create headings and lists.`}
                      imagesMaxWidth={null}
                      imagesMaxHeight={window.innerHeight / 2}
                      css={(t) => css({ fontSize: t.text.sizes.large })}
                      style={{ flex: 1, minHeight: "12rem" }}
                    />
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        minHeight: "12rem",
                        paddingBottom: "3.2rem",
                      }}
                    >
                      <AutoAdjustingHeightTextarea
                        value={draft.body}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;

                          e.preventDefault();

                          const textBeforeSelection = e.target.value.slice(
                            0,
                            e.target.selectionStart
                          );
                          const textAfterSelection = e.target.value.slice(
                            e.target.selectionEnd
                          );

                          const lineTextBeforeSelection = textBeforeSelection
                            .split("\n")
                            .slice(-1)[0];

                          const indentCount =
                            lineTextBeforeSelection.length -
                            lineTextBeforeSelection.trimStart().length;

                          setBody(
                            [
                              textBeforeSelection,
                              textAfterSelection.padStart(indentCount, " "),
                            ].join("\n")
                          );

                          document.execCommand(
                            "insertText",
                            undefined,
                            "\n" + "".padEnd(indentCount, " ")
                          );
                        }}
                        onChange={(e) => {
                          setBody(e.target.value);
                        }}
                        placeholder="Raw markdown mode..."
                        css={(t) =>
                          css({
                            outline: "none",
                            border: 0,
                            fontSize: t.text.sizes.large,
                            color: t.colors.textNormal,
                            padding: 0,
                            width: "100%",
                            fontFamily: t.fontStacks.monospace,
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                {editorMode === "rich-text" && (
                  <>
                    <FloatingToolbar
                      isVisible={isFloatingToolbarVisible}
                      scrollContainerRef={scrollContainerRef}
                      onFocus={() => {
                        setHasFloatingToolbarFocus(true);
                      }}
                      onBlur={() => {
                        setHasFloatingToolbarFocus(false);
                      }}
                    />
                    <FixedBottomToolbar
                      isVisible={
                        isEditorFocused &&
                        (isTouchDevice() || !isFloatingToolbarVisible)
                      }
                    />
                  </>
                )}
              </div>
            </MainContentContainer>
          </form>
        </EditorProvider>
      </Layout>

      {selectedAction != null && (
        <ActionDialog
          isOpen
          close={() => {
            setSelectedActionIndex(null);
          }}
          title="Edit action"
          submit={(a) => {
            setActions(
              draft.actions.map((a_, i) => (i !== selectedActionIndex ? a_ : a))
            );
          }}
          remove={() => {
            setActions(
              draft.actions.filter((_, i) => i !== selectedActionIndex)
            );
          }}
          initialType={selectedAction.type}
          initialCurrency={selectedAction.currency}
          initialAmount={selectedAction.amount}
          initialTarget={selectedAction.target}
          initialStreamStartTimestamp={selectedAction.startTimestamp}
          initialStreamEndTimestamp={selectedAction.endTimestamp}
          initialContractAddress={selectedAction.contractAddress}
          initialContractFunction={selectedAction.contractFunction}
          initialContractFunctionInput={selectedAction.contractFunctionInput}
          initialContractCustomAbiString={
            selectedAction.contractCustomAbiString
          }
        />
      )}

      {showNewActionDialog && (
        <ActionDialog
          isOpen
          close={() => {
            setShowNewActionDialog(false);
          }}
          title="Add action"
          submit={(a) => {
            setActions([...draft.actions, a]);
          }}
          submitButtonLabel="Add"
        />
      )}
    </>
  );
};

const FloatingToolbar = ({
  scrollContainerRef,
  isVisible,
  onFocus,
  onBlur,
}) => {
  const containerRef = React.useRef();

  // Update position and visibility
  React.useEffect(() => {
    const el = containerRef.current;

    if (!isVisible) {
      el.style.pointerEvents = "none";
      el.style.opacity = "0";
      return;
    }

    const scrollContainerEl = scrollContainerRef.current;

    const updatePosition = () => {
      const domSelection = window.getSelection();
      const domRange = domSelection.getRangeAt(0);
      const rect = domRange.getBoundingClientRect();
      const scrollContainerRect = scrollContainerEl.getBoundingClientRect();

      const selectionTop = rect.top + window.scrollY - el.offsetHeight;
      const scrollContainerTop = scrollContainerRect.top + window.scrollY;

      el.style.display = "block";
      el.style.position = "absolute";
      el.style.top = Math.max(scrollContainerTop, selectionTop - 12) + "px";

      const leftOffset = rect.left + window.scrollX - 36;

      if (el.offsetWidth >= window.innerWidth - 32) {
        el.style.right = "auto";
        el.style.left = 16 + "px";
      } else if (leftOffset + el.offsetWidth + 16 > window.innerWidth) {
        el.style.left = "auto";
        el.style.right = 16 + "px";
      } else {
        el.style.right = "auto";
        el.style.left = Math.max(16, leftOffset) + "px";
      }

      el.style.pointerEvents = "auto";
      el.style.opacity = "1";
    };

    scrollContainerEl.addEventListener("scroll", updatePosition);

    updatePosition();

    return () => {
      scrollContainerEl.removeEventListener("scroll", updatePosition);
    };
  });

  return (
    <Overlay>
      <div
        ref={containerRef}
        css={css({ transition: "0.1s opacity ease-out" })}
      >
        <nav
          css={css({
            display: "flex",
            gap: "1.6rem",
            maxWidth: "calc(100vw - 3.2rem)",
            width: "max-content",
          })}
        >
          <div
            css={(t) =>
              css({
                padding: "0.3rem",
                borderRadius: "0.3rem",
                background: t.colors.backgroundPrimary,
                boxShadow: t.shadows.elevationHigh,
              })
            }
          >
            <EditorToolbar onFocus={onFocus} onBlur={onBlur} />
          </div>
        </nav>
      </div>
    </Overlay>
  );
};

const FixedBottomToolbar = ({ isVisible = false }) => {
  const ref = React.useRef();

  // Fix to top of soft keyboard on touch devices
  React.useEffect(() => {
    if (!isTouchDevice()) return;

    const el = ref.current;

    const updatePosition = () => {
      const viewport = window.visualViewport;
      el.style.opacity = isVisible ? "1" : "0";

      if (viewport.height >= window.innerHeight) {
        el.dataset.fixedToKeyboard = false;
        return;
      }

      el.dataset.fixedToKeyboard = true;
      el.style.top =
        viewport.offsetTop + viewport.height - el.offsetHeight + "px";
    };

    const handleTouchMove = (e) => {
      const { target } = e.touches[0];
      if (el == target || el.contains(target)) return;
      // iOS will only fire the last scroll event, so we hide the toolbar until
      // the scroll finishes to prevent it from rendering in the wrong position
      el.style.opacity = "0";
    };

    window.visualViewport.addEventListener("resize", updatePosition);
    window.visualViewport.addEventListener("scroll", updatePosition);
    addEventListener("touchmove", handleTouchMove);

    updatePosition();

    return () => {
      window.visualViewport.removeEventListener("resize", updatePosition);
      window.visualViewport.removeEventListener("scroll", updatePosition);
      removeEventListener("touchmove", handleTouchMove);
    };
  });

  return (
    <>
      <nav
        ref={ref}
        aria-hidden={!isVisible}
        data-touch={isTouchDevice()}
        css={(t) =>
          css({
            position: "sticky",
            top: "auto",
            bottom: 0,
            maxWidth: "calc(100vw - 3.2rem)",
            width: "max-content",
            padding: "1.6rem 0",
            pointerEvents: "none",
            transition: "0.1s opacity ease-out",
            "[data-box]": {
              pointerEvents: "auto",
              padding: "0.3rem",
              borderRadius: "0.3rem",
              background: t.colors.backgroundPrimary,
              boxShadow: t.shadows.elevationLow,
              transition: "0.1s opacity ease-out",
            },
            '&[data-touch="true"]': {
              display: "none",
            },
            '&[data-fixed-to-keyboard="true"]': {
              display: "block",
              position: "fixed",
              zIndex: 100,
              bottom: "auto",
              left: 0,
              width: "100%",
              maxWidth: "100%",
              margin: 0,
              padding: "0.8rem",
              background: t.colors.backgroundPrimary,
              borderTop: "0.1rem solid",
              borderColor: t.colors.borderLight,
              "[data-box]": {
                padding: 0,
                boxShadow: "none",
              },
            },
            '&[aria-hidden="true"]': {
              opacity: 0,
              pointerEvents: "none",
            },
          })
        }
      >
        <div data-box>
          <EditorToolbar />
        </div>
      </nav>

      <GlobalStyles
        styles={css({
          // This makes the scroll work roughly as expected when toggling the
          // soft keyboard on iOS. Doesn’t seem to break anything, I dunno.
          "@media(hover: none)": {
            html: {
              overflow: "auto",
            },
          },
        })}
      />
    </>
  );
};

const currencyFractionDigits = {
  eth: [1, 4],
  weth: [1, 4],
  usdc: [2, 2],
};

const ActionExplanation = ({ action: a }) => {
  const { displayName: targetDisplayName } = useAccountDisplayName(a.target);

  switch (a.type) {
    case "one-time-payment": {
      const [minimumFractionDigits, maximumFractionDigits] =
        currencyFractionDigits[a.currency];

      return (
        <>
          Transfer{" "}
          <em>
            <FormattedNumber
              value={a.amount}
              minimumFractionDigits={minimumFractionDigits}
              maximumFractionDigits={maximumFractionDigits}
            />{" "}
            {a.currency.toUpperCase()}
          </em>{" "}
          to <em>{targetDisplayName}</em>
        </>
      );
    }

    case "streaming-payment": {
      const [minimumFractionDigits, maximumFractionDigits] =
        currencyFractionDigits[a.currency];

      return (
        <>
          Stream{" "}
          <em>
            <FormattedNumber
              value={a.amount}
              minimumFractionDigits={minimumFractionDigits}
              maximumFractionDigits={maximumFractionDigits}
            />{" "}
            {a.currency.toUpperCase()}
          </em>{" "}
          to <em>{targetDisplayName}</em> between{" "}
          <em>
            <FormattedDate
              value={a.startTimestamp}
              day="numeric"
              month="short"
              year={
                getDateYear(a.startTimestamp) === getDateYear(a.endTimestamp)
                  ? undefined
                  : "numeric"
              }
            />
          </em>{" "}
          and{" "}
          <em>
            <FormattedDate
              value={a.endTimestamp}
              day="numeric"
              month="short"
              year="numeric"
            />
          </em>
        </>
      );
    }

    // case "monthly-payment": {
    //   const formattedUnits = formatUnits(
    //     t.tokenAmount,
    //     decimalsByCurrency[t.token]
    //   );
    //   // TODO: handle unknown token contract
    //   return (
    //     <>
    //       Stream{" "}
    //       {t.token != null && (
    //         <>
    //           <em>
    //             {t.token === "USDC"
    //               ? parseFloat(formattedUnits).toLocaleString()
    //               : formattedUnits}{" "}
    //             {t.token}
    //           </em>{" "}
    //         </>
    //       )}
    //       to{" "}
    //       <em>
    //         <AddressDisplayNameWithTooltip address={t.receiverAddress} />
    //       </em>{" "}
    //       between{" "}
    //       <FormattedDateWithTooltip
    //         disableRelative
    //         day="numeric"
    //         month="short"
    //         year="numeric"
    //         value={t.startDate}
    //       />{" "}
    //       and{" "}
    //       <FormattedDateWithTooltip
    //         disableRelative
    //         day="numeric"
    //         month="short"
    //         year="numeric"
    //         value={t.endDate}
    //       />{" "}
    //       ({datesDifferenceInMonths(t.endDate, t.startDate)} months)
    //     </>
    //   );
    // }

    case "custom-transaction":
      return (
        <TransactionExplanation transaction={getActionTransactions(a)[0]} />
      );

    default:
      throw new Error(`Unknown action type: "${a.type}"`);
  }
};

export default () => {
  const { draftId } = useParams();

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [draft] = useDraft(draftId);
  const { items: drafts, createItem: createDraft } = useDrafts();

  React.useEffect(() => {
    if (draftId != null && draft === null) navigate("/", { replace: true });
  }, [draftId, draft, navigate]);

  const getFirstEmptyDraft = useLatestCallback(() =>
    drafts.find((draft) => {
      const isEmpty =
        draft.name.trim() === "" &&
        draft.actions.length === 0 &&
        draft.body.length === 1 &&
        isRichTextEditorNodeEmpty(draft.body[0]);

      return isEmpty;
    })
  );

  React.useEffect(() => {
    if (draftId != null) return;

    const emptyDraft = getFirstEmptyDraft();

    if (emptyDraft) {
      navigate(`/new/${emptyDraft.id}?${searchParams}`, { replace: true });
      return;
    }

    createDraft().then((d) => {
      navigate(`/new/${d.id}?${searchParams}`, { replace: true });
    });
  }, [draftId, createDraft, getFirstEmptyDraft, navigate, searchParams]);

  if (draft == null) return null; // Spinner

  return <ProposeScreen />;
};

import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import * as Tooltip from "@shades/ui-web/tooltip";
import Spinner from "@shades/ui-web/spinner";
import Link from "@shades/ui-web/link";
import { isSucceededState as isSucceededProposalState } from "../utils/proposals.js";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  makeUrlId as makeCandidateUrlId,
} from "../utils/candidates.js";
import { useNoun, useProposal, useProposalCandidate } from "../store.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import AccountAvatar from "./account-avatar.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import { useSaleInfo } from "../hooks/sales.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import NounMultiPreviewPopoverTrigger from "./noun-multi-preview-popover-trigger.js";

const MarkdownRichText = React.lazy(() => import("./markdown-rich-text.js"));

const BODY_TRUNCATION_HEIGHT_THRESHOLD = "18em";

const ActivityFeed = ({ context, items = [], spacing = "2rem" }) => (
  <ul
    css={(t) =>
      css({
        lineHeight: 1.4285714286, // 20px line height given font size if 14px
        fontSize: t.text.sizes.base,
        '[role="listitem"] + [role="listitem"]': {
          marginTop: "var(--vertical-spacing)",
        },
        '[data-pending="true"]': { opacity: 0.6 },
        "[data-nowrap]": { whiteSpace: "nowrap" },
        "[data-header]": {
          display: "grid",
          gridTemplateColumns: "2rem minmax(0,1fr)",
          gridGap: "0.6rem",
          alignItems: "flex-start",
          a: {
            color: t.colors.textDimmed,
            fontWeight: t.text.weights.emphasis,
            textDecoration: "none",
            "@media(hover: hover)": {
              ":hover": { textDecoration: "underline" },
            },
          },
        },
        "[data-avatar-button]": {
          display: "block",
          outline: "none",
          ":focus-visible [data-avatar]": {
            boxShadow: t.shadows.focus,
            background: t.colors.backgroundModifierHover,
          },
          "@media (hover: hover)": {
            ":not(:disabled)": {
              cursor: "pointer",
              ":hover [data-avatar]": {
                boxShadow: `0 0 0 0.2rem ${t.colors.backgroundModifierHover}`,
              },
            },
          },
        },
        "[data-timeline-symbol]": {
          position: "relative",
          height: "2rem",
          width: "0.1rem",
          background: t.colors.borderLight,
          zIndex: -1,
          margin: "auto",
          ":after": {
            content: '""',
            position: "absolute",
            width: "0.7rem",
            height: "0.7rem",
            background: t.colors.textMuted,
            top: "50%",
            left: "50%",
            transform: "translateY(-50%) translateX(-50%)",
            borderRadius: "50%",
            border: "0.1rem solid",
            borderColor: t.colors.backgroundPrimary,
          },
        },
      })
    }
    style={{ "--vertical-spacing": spacing }}
  >
    {items.map((item) => (
      <FeedItem key={item.id} {...item} context={context} />
    ))}
  </ul>
);

const FeedItem = React.memo(({ context, ...item }) => {
  const isIsolatedContext = ["proposal", "candidate"].includes(context);
  return (
    <div key={item.id} role="listitem" data-pending={item.isPending}>
      <div data-header>
        <div>
          {item.type === "event" || item.authorAccount == null ? (
            <div data-timeline-symbol />
          ) : (
            <AccountPreviewPopoverTrigger accountAddress={item.authorAccount}>
              <button data-avatar-button>
                <AccountAvatar
                  data-avatar
                  address={item.authorAccount}
                  size="2rem"
                />
              </button>
            </AccountPreviewPopoverTrigger>
          )}
        </div>
        <div>
          <div
            css={css({
              display: "flex",
              alignItems: "flex-start",
              gap: "1rem",
              cursor: "default",
            })}
          >
            <div
              css={(t) =>
                css({
                  flex: 1,
                  minWidth: 0,
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  color: t.colors.textDimmed,
                })
              }
            >
              <span css={(t) => css({ color: t.colors.textNormal })}>
                <ItemTitle item={item} context={context} />
              </span>
            </div>
            <div>
              {item.isPending ? (
                <div style={{ padding: "0.5rem 0" }}>
                  <Spinner size="1rem" />
                </div>
              ) : (
                item.timestamp != null && (
                  <span
                    data-timestamp
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.small,
                        color: t.colors.textDimmed,
                        padding: "0.15rem 0",
                        display: "inline-block",
                      })
                    }
                  >
                    <FormattedDateWithTooltip
                      tinyRelative
                      relativeDayThreshold={7}
                      month="short"
                      day="numeric"
                      value={item.timestamp}
                    />
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>
      <div css={css({ paddingLeft: "2.6rem", userSelect: "text" })}>
        {(item.body || null) != null && (
          <React.Suspense
            fallback={
              <div
                css={(t) =>
                  css({
                    margin: "0.5rem 0",
                    background: t.colors.backgroundModifierNormal,
                    borderRadius: "0.3rem",
                  })
                }
              >
                &nbsp;
              </div>
            }
          >
            <ItemBody
              text={item.body}
              displayImages={item.type === "event"}
              truncateLines={!isIsolatedContext}
            />
          </React.Suspense>
        )}
        {item.type === "candidate-signature-added" && (
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
              })
            }
          >
            {item.isCanceled ? (
              "Signature canceled"
            ) : (
              <>
                {item.expiresAt < new Date()
                  ? "Signature expired"
                  : "Signature expires"}{" "}
                <FormattedDateWithTooltip
                  capitalize={false}
                  value={item.expiresAt}
                  month="short"
                  day="numeric"
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const ItemBody = React.memo(
  ({ text, displayImages, truncateLines: enableLineTruncation }) => {
    const containerRef = React.useRef();

    const [isCollapsed_, setCollapsed] = React.useState(enableLineTruncation);
    const [exceedsTruncationThreshold, setExceedsTruncationThreshold] =
      React.useState(null);

    const isCollapsed = enableLineTruncation && isCollapsed_;
    const isEffectivelyTruncating = isCollapsed && exceedsTruncationThreshold;

    React.useEffect(() => {
      if (!isCollapsed) return;

      const observer = new ResizeObserver(() => {
        if (containerRef.current == null) return;
        setExceedsTruncationThreshold(
          containerRef.current.scrollHeight -
            containerRef.current.offsetHeight >
            100
        );
      });

      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    }, [isCollapsed]);

    return (
      <div css={css({ padding: "0.5rem 0" })}>
        <div
          ref={containerRef}
          css={css({ overflow: "hidden" })}
          style={{
            maxHeight: isCollapsed
              ? BODY_TRUNCATION_HEIGHT_THRESHOLD
              : undefined,
            maskImage: isEffectivelyTruncating
              ? "linear-gradient(180deg, black calc(100% - 2.8em), transparent 100%)"
              : undefined,
          }}
        >
          <MarkdownRichText
            text={text}
            displayImages={displayImages}
            compact
            css={css({
              // Make all headings small
              "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
              "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": { marginTop: "1.5em" },
              "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                {
                  marginBottom: "0.625em",
                },
            })}
          />
        </div>

        {enableLineTruncation && exceedsTruncationThreshold && (
          <div css={css({ margin: "0.8em 0" })}>
            <Link
              component="button"
              onClick={() => setCollapsed((c) => !c)}
              size="small"
              color={(t) => t.colors.textDimmed}
            >
              {isCollapsed ? "Expand..." : "Collapse"}
            </Link>
          </div>
        )}
      </div>
    );
  }
);

const ItemTitle = ({ item, context }) => {
  const isIsolatedContext = ["proposal", "candidate"].includes(context);

  const proposal = useProposal(item.proposalId ?? item.targetProposalId);
  const candidate = useProposalCandidate(item.candidateId);

  const ContextLink = ({ proposalId, candidateId, short, children }) => {
    if (proposalId != null) {
      const title =
        proposal?.title == null
          ? `Proposal ${proposalId}`
          : `${short ? proposalId : `Proposal ${proposalId}`}: ${
              proposal.title
            } `;
      return (
        <RouterLink to={`/proposals/${proposalId}`}>
          {children ?? title}
        </RouterLink>
      );
    }

    if (candidateId != null) {
      const title =
        candidate?.latestVersion?.content.title ??
        extractSlugFromCandidateId(candidateId);
      return (
        <RouterLink
          to={`/candidates/${encodeURIComponent(
            makeCandidateUrlId(candidateId)
          )}`}
        >
          {children ?? title}
        </RouterLink>
      );
    }

    throw new Error();
  };

  const accountName = (
    <AccountPreviewPopoverTrigger accountAddress={item.authorAccount} />
  );

  switch (item.type) {
    case "event": {
      switch (item.eventType) {
        case "proposal-created":
        case "proposal-updated":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              {item.eventType === "proposal-created" ? "created" : "updated"}
              {item.authorAccount != null && (
                <>
                  {" "}
                  by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={item.authorAccount}
                  />
                </>
              )}
            </span>
          );

        case "candidate-created":
        case "candidate-updated": {
          const label =
            context === "candidate" ? (
              "Candidate"
            ) : context === "proposal" ? (
              <ContextLink {...item}>
                {item.targetProposalId != null
                  ? "Update candidate"
                  : "Candidate"}
              </ContextLink>
            ) : item.targetProposalId != null ? (
              <>
                <ContextLink {...item}>Update candidate</ContextLink> for{" "}
                <ContextLink proposalId={item.targetProposalId} truncate />
              </>
            ) : (
              <>
                Candidate <ContextLink {...item} />
              </>
            );

          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {label}{" "}
              {item.eventType === "candidate-created" ? "created" : "updated"}
              {item.authorAccount != null && (
                <>
                  {" "}
                  by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={item.authorAccount}
                  />
                </>
              )}
            </span>
          );
        }

        case "candidate-canceled":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? (
                <ContextLink {...item}>
                  {item.targetProposalId == null
                    ? "Candidate"
                    : "Update candidate"}
                </ContextLink>
              ) : context === "candidate" ? (
                "Candidate"
              ) : (
                <ContextLink {...item} />
              )}{" "}
              was canceled
            </span>
          );

        case "proposal-started":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              Voting{" "}
              {context !== "proposal" && (
                <>
                  for <ContextLink {...item} />
                </>
              )}{" "}
              started{" "}
            </span>
          );

        case "proposal-ended":
          return (
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              {isSucceededProposalState(proposal.state) ? (
                <span
                  css={(t) =>
                    css({
                      color: t.colors.textPositive,
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  succeeded
                </span>
              ) : (
                <>
                  was{" "}
                  <span
                    css={(t) =>
                      css({
                        color: t.colors.textNegative,
                        fontWeight: t.text.weights.emphasis,
                      })
                    }
                  >
                    defeated
                  </span>
                </>
              )}
            </span>
          );

        case "proposal-objection-period-started":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              entered objection period
            </span>
          );

        case "proposal-queued":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was queued for execution
            </span>
          );

        case "proposal-executed":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was{" "}
              <span
                css={(t) =>
                  css({
                    color: t.colors.textPositive,
                    fontWeight: t.text.weights.emphasis,
                  })
                }
              >
                executed
              </span>
            </span>
          );

        case "proposal-canceled":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was{" "}
              <span
                css={(t) =>
                  css({
                    color: t.colors.textNegative,
                    fontWeight: t.text.weights.emphasis,
                  })
                }
              >
                canceled
              </span>
            </span>
          );

        case "propdate-posted":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              <a
                href="https://propdates.wtf/about"
                target="_blank"
                rel="noreferrer"
              >
                Propdate
              </a>
              {context !== "proposal" && (
                <>
                  {" "}
                  for <ContextLink {...item} />
                </>
              )}
            </span>
          );

        case "propdate-marked-completed":
          return (
            <span
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                })
              }
            >
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              marked as completed via{" "}
              <a
                href="https://propdates.wtf/about"
                target="_blank"
                rel="noreferrer"
              >
                Propdate
              </a>
            </span>
          );

        default:
          throw new Error(`Unknown event "${item.eventType}"`);
      }
    }

    case "vote":
    case "feedback-post": {
      const signalWord = item.type === "vote" ? "voted" : "signaled";
      return (
        <span>
          {accountName}{" "}
          {item.support === 0 ? (
            <Signal negative>
              {signalWord} against ({item.voteCount})
            </Signal>
          ) : item.support === 1 ? (
            <Signal positive>
              {signalWord} for ({item.voteCount})
            </Signal>
          ) : item.type === "vote" ? (
            <Signal>abstained</Signal>
          ) : isIsolatedContext ? (
            "commented"
          ) : (
            "commented on"
          )}
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink short {...item} />
            </>
          )}
        </span>
      );
    }

    case "candidate-signature-added":
      return (
        <span>
          {accountName} <Signal positive>sponsored candidate</Signal>
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink short {...item} />
            </>
          )}
        </span>
      );

    case "noun-auction-bought":
    case "noun-transferred":
      return (
        <span
          css={(t) =>
            css({
              color: t.colors.textDimmed,
            })
          }
        >
          <TransferItem item={item} />
        </span>
      );

    case "noun-delegated":
    case "noun-undelegated":
      return (
        <span
          css={(t) =>
            css({
              color: t.colors.textDimmed,
            })
          }
        >
          <span>
            {accountName}{" "}
            {item.type === "noun-delegated" ? (
              <Signal positive>delegated</Signal>
            ) : (
              <Signal negative>undelegated</Signal>
            )}{" "}
            {item.nouns.length > 1 ? (
              <NounMultiPreviewPopoverTrigger inline nounIds={item.nouns} />
            ) : (
              <NounPreviewPopoverTrigger
                inline
                nounId={item.nounId}
                popoverPlacement="top"
                css={(t) => css({ color: t.colors.textDimmed })}
              />
            )}{" "}
            {item.type === "noun-delegated" ? (
              <>
                to{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={item.toAccount}
                />
              </>
            ) : (
              <>
                from{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={item.fromAccount}
                />
              </>
            )}
          </span>
        </span>
      );

    default:
      throw new Error(`Unknown event type "${item.type}"`);
  }
};

const TransferItem = ({ item }) => {
  const saleAmount = useSaleInfo({
    transactionHash: item?.transactionHash,
    sourceAddress: item.toAccount,
  });

  const noun = useNoun(item.nounId);
  const nounAuctionAmount = noun ? parseInt(noun.auction?.amount) : null;
  const accountName = (
    <AccountPreviewPopoverTrigger accountAddress={item.authorAccount} />
  );

  switch (item.type) {
    case "noun-auction-bought":
      return (
        <span>
          {accountName} bought{" "}
          <NounPreviewPopoverTrigger
            inline
            nounId={item.nounId}
            popoverPlacement="top"
            css={(t) => css({ color: t.colors.textDimmed })}
          />
          {nounAuctionAmount && (
            <>
              {" "}
              for{" "}
              <FormattedEthWithConditionalTooltip value={nounAuctionAmount} />
            </>
          )}{" "}
          from auction house
        </span>
      );

    case "noun-transferred":
      if (saleAmount && saleAmount > 0) {
        if (item.authorAccount.toLowerCase() === item.toAccount.toLowerCase()) {
          return (
            <span>
              {accountName} bought{" "}
              <NounPreviewPopoverTrigger
                inline
                nounId={item.nounId}
                popoverPlacement="top"
                css={(t) => css({ color: t.colors.textDimmed })}
              />{" "}
              for <FormattedEthWithConditionalTooltip value={saleAmount} /> from{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={item.fromAccount}
              />{" "}
            </span>
          );
        } else {
          return (
            <span>
              {accountName} sold{" "}
              <NounPreviewPopoverTrigger
                inline
                nounId={item.nounId}
                popoverPlacement="top"
                css={(t) => css({ color: t.colors.textDimmed })}
              />{" "}
              for <FormattedEthWithConditionalTooltip value={saleAmount} /> to{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={item.toAccount}
              />{" "}
            </span>
          );
        }
      }

      return (
        <span>
          {accountName} transferred{" "}
          {item.nouns.length > 1 ? (
            <NounMultiPreviewPopoverTrigger inline nounIds={item.nouns} />
          ) : (
            <NounPreviewPopoverTrigger
              inline
              nounId={item.nounId}
              popoverPlacement="top"
              css={(t) => css({ color: t.colors.textDimmed })}
            />
          )}{" "}
          to{" "}
          <AccountPreviewPopoverTrigger
            showAvatar
            accountAddress={item.toAccount}
          />
        </span>
      );
  }
};

const Signal = ({ positive, negative, ...props }) => (
  <span
    css={(t) =>
      css({
        "--positive-text": t.colors.textPositive,
        "--negative-text": t.colors.textNegative,
        "--neutral-text": t.colors.textDimmed,
        color: "var(--color)",
        fontWeight: t.text.weights.emphasis,
      })
    }
    style={{
      "--color": positive
        ? "var(--positive-text)"
        : negative
        ? "var(--negative-text)"
        : "var(--neutral-text)",
    }}
    {...props}
  />
);

export const VotingPowerNoggle = ({ count }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span
        css={(t) =>
          css({
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
          })
        }
      >
        {count}
        <NogglesIcon
          style={{
            display: "inline-flex",
            width: "1.7rem",
            height: "auto",
          }}
        />
      </span>
    </Tooltip.Trigger>
    <Tooltip.Content side="top" sideOffset={5}>
      {count} {count === 1 ? "noun" : "nouns"}
    </Tooltip.Content>
  </Tooltip.Root>
);

export default ActivityFeed;

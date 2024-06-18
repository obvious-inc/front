import getDateYear from "date-fns/getYear";
import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import Spinner from "@shades/ui-web/spinner";
import Link from "@shades/ui-web/link";
import Avatar from "@shades/ui-web/avatar";
import { FarcasterGate as FarcasterGateIcon } from "@shades/ui-web/icons";
import { isSucceededState as isSucceededProposalState } from "../utils/proposals.js";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  makeUrlId as makeCandidateUrlId,
} from "../utils/candidates.js";
import { useWallet } from "../hooks/wallet.js";
import { useNoun, useProposal, useProposalCandidate } from "../store.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import AccountAvatar from "./account-avatar.js";
import MarkdownRichText from "./markdown-rich-text.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import NounsPreviewPopoverTrigger from "./nouns-preview-popover-trigger.js";
import { useSaleInfo } from "../hooks/sales.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";

const BODY_TRUNCATION_HEIGHT_THRESHOLD = 250;

const ActivityFeed = ({
  context,
  items = [],
  spacing = "2rem",
  onReply,
  onRepost,
  onLike,
}) => (
  <ul
    css={(t) =>
      css({
        lineHeight: "calc(20/14)", // 20px line height given font size if 14px
        fontSize: t.text.sizes.base,
        '[role="listitem"]': {
          scrollMargin: "calc(3.2rem + 1.6rem) 0",
        },
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
      <FeedItem
        key={item.id}
        {...item}
        context={context}
        onReply={onReply}
        onRepost={onRepost}
        onLike={onLike}
      />
    ))}
  </ul>
);

const FeedItem = React.memo(
  ({ context, onReply, onRepost, onLike, ...item }) => {
    const { address: connectedAccount } = useWallet();
    const isIsolatedContext = ["proposal", "candidate"].includes(context);
    const hasBody = item.body != null && item.body.trim() !== "";
    const hasReason = item.reason != null && item.reason.trim() !== "";
    // const hasMultiParagraphBody =
    //   hasBody && item.body.trim().split("\n").length > 1;

    const hasReposts = item.reposts?.length > 0;

    const showReplyAction =
      onReply != null &&
      connectedAccount != null &&
      ["vote", "feedback-post"].includes(item.type) &&
      hasReason;

    const showRepostAction =
      onRepost != null &&
      connectedAccount != null &&
      ["vote", "feedback-post"].includes(item.type) &&
      hasReason;

    const showLikeAction =
      onLike != null &&
      connectedAccount != null &&
      ["vote", "feedback-post", "farcaster-cast"].includes(item.type);

    const enableReplyAction = !item.isPending;
    const enableRepostAction = !item.isPending;
    const enableLikeAction = !item.isPending;

    const showActionBar = showReplyAction || showRepostAction || showLikeAction;

    return (
      <div
        key={item.id}
        id={item.id}
        role="listitem"
        data-pending={item.isPending}
      >
        <div data-header>
          <div>
            {item.type === "farcaster-cast" ? (
              <div style={{ position: "relative" }}>
                {item.authorAccount == null ? (
                  <Avatar url={item.authorAvatarUrl} size="2rem" />
                ) : (
                  <AccountPreviewPopoverTrigger
                    accountAddress={item.authorAccount}
                  >
                    <button data-avatar-button>
                      <AccountAvatar
                        address={item.authorAccount}
                        fallbackImageUrl={item.authorAvatarUrl}
                        size="2rem"
                      />
                    </button>
                  </AccountPreviewPopoverTrigger>
                )}
                <span
                  css={(t) =>
                    css({
                      position: "absolute",
                      top: 0,
                      right: 0,
                      display: "flex",
                      width: "1rem",
                      height: "1rem",
                      borderRadius: "50%",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#855DCD", // Farcaster purple
                      transform: "translateY(-35%) translateX(35%)",
                      boxShadow: `0 0 0 0.15rem ${t.colors.backgroundPrimary}`,
                      svg: { width: "0.6rem", height: "auto", color: "white" },
                    })
                  }
                >
                  <FarcasterGateIcon />
                </span>
              </div>
            ) : item.type === "event" || item.authorAccount == null ? (
              <div data-timeline-symbol />
            ) : (
              <AccountPreviewPopoverTrigger accountAddress={item.authorAccount}>
                <button data-avatar-button>
                  <AccountAvatar address={item.authorAccount} size="2rem" />
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
                    // display: "-webkit-box",
                    // WebkitBoxOrient: "vertical",
                    // WebkitLineClamp: 2,
                    // overflow: "hidden",
                    color: t.colors.textNormal,
                  })
                }
              >
                {/* <span css={(t) => css({ color: t.colors.textNormal })}> */}
                <ItemTitle item={item} context={context} />
                {/* </span> */}
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
                        year={
                          getDateYear(item.timestamp) !==
                          getDateYear(new Date())
                            ? "numeric"
                            : undefined
                        }
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
          {item.replies?.length > 0 && (
            <ul
              className="reply-list"
              css={(t) =>
                css({
                  margin: "0",
                  "& > li": {
                    listStyle: "none",
                    ".text-input": {
                      margin: "0.4rem 0 0",
                      padding: "0.3rem 0",
                    },
                  },
                  "li + li": { marginTop: "1.6rem" },
                  ".body-container": {
                    padding: "0.4em 0 0 0.2em",
                  },
                  ".reply-area": {
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0,1fr)",
                    gap: "0.3rem",
                  },
                  ".reply-line-container": {
                    width: "2.2rem",
                    position: "relative",
                  },
                  ".reply-line": {
                    position: "absolute",
                    top: 0,
                    right: "0.2rem",
                    width: "0.6rem",
                    height: "1.9rem",
                    borderLeft: "0.1rem solid",
                    borderBottom: "0.1rem solid",
                    borderColor: t.colors.borderLight,
                    borderBottomLeftRadius: "0.3rem",
                  },
                })
              }
              style={{
                marginTop: "0.8rem",
                marginBottom: hasReposts || hasBody ? "1.6rem" : 0,
              }}
            >
              {item.replies.map(({ body, target }) => (
                <li key={target.id}>
                  <QuotedVoteOrFeedbackPost
                    item={target}
                    href={
                      context !== "proposal"
                        ? `/proposals/${item.proposalId}?tab=activity#${item.id}`
                        : `#${item.id}`
                    }
                    showSignal
                  />
                  <div className="reply-area">
                    <div className="reply-line-container">
                      <div className="reply-line" />
                    </div>
                    <div className="body-container">
                      <MarkdownRichText
                        text={body}
                        // displayImages={displayImages}
                        compact
                        css={css({
                          // Make all headings small
                          "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
                          "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": {
                            marginTop: "1.5em",
                          },
                          "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                            {
                              marginBottom: "0.625em",
                            },
                        })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {item.reposts?.length > 0 && (
            <ul
              css={css({
                listStyle: "none",
                fontSize: "0.875em",
                marginBottom: "0.8rem",
                "li + li": { marginTop: "0.6rem" },
              })}
              // style={{ marginTop: hasMultiParagraphBody ? "0.8rem" : "0.4rem" }}
              style={{ marginTop: "0.8rem" }}
            >
              {item.reposts.map((voteOrFeedbackPost) => (
                <li key={voteOrFeedbackPost.id}>
                  <QuotedVoteOrFeedbackPost
                    item={voteOrFeedbackPost}
                    href={
                      context !== "proposal"
                        ? `/proposals/${item.proposalId}?tab=activity#${item.id}`
                        : `#${item.id}`
                    }
                    showSignal={
                      // Don’t render support for abstained feedback reposts
                      !(item.type === "feedback-post" && item.support === 2) ||
                      item.reposts.some(
                        (repost) => repost.support !== item.support,
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {hasBody && (
            <ItemBody
              text={item.body}
              displayImages={item.type === "event"}
              truncateLines={!isIsolatedContext}
            />
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

          {showActionBar && (
            <div
              css={(t) =>
                css({
                  display: "flex",
                  gap: "0.8rem",
                  margin: "0.6rem -0.4rem 0",
                  button: {
                    padding: "0.4rem",
                    color: t.colors.textDimmed,
                    ":disabled": {
                      color: t.colors.textMuted,
                    },
                    "@media(hover: hover)": {
                      ":not(:disabled)": {
                        cursor: "pointer",
                        ":hover": { color: t.colors.textAccent },
                      },
                    },
                  },
                })
              }
            >
              {showReplyAction && (
                <button
                  onClick={() => {
                    onReply(item.id);
                  }}
                  disabled={!enableReplyAction}
                >
                  <svg
                    aria-label="Reply"
                    role="img"
                    viewBox="0 0 18 18"
                    stroke="currentColor"
                    fill="transparent"
                    style={{ width: "1.4rem", height: "auto" }}
                  >
                    <path
                      d="M15.376 13.2177L16.2861 16.7955L12.7106 15.8848C12.6781 15.8848 12.6131 15.8848 12.5806 15.8848C11.3779 16.5678 9.94767 16.8931 8.41995 16.7955C4.94194 16.5353 2.08152 13.7381 1.72397 10.2578C1.2689 5.63919 5.13697 1.76863 9.75264 2.22399C13.2307 2.58177 16.0261 5.41151 16.2861 8.92429C16.4161 10.453 16.0586 11.8841 15.376 13.0876C15.376 13.1526 15.376 13.1852 15.376 13.2177Z"
                      strokeLinejoin="round"
                      strokeWidth="1.25"
                    />
                  </svg>
                </button>
              )}
              {showRepostAction && (
                <button
                  onClick={() => {
                    onRepost(item.id);
                  }}
                  disabled={!enableRepostAction}
                >
                  <svg
                    aria-label="Repost"
                    viewBox="0 0 18 18"
                    fill="currentColor"
                    style={{ width: "1.4rem", height: "auto" }}
                  >
                    <path d="M6.41256 1.23531C6.6349 0.971277 7.02918 0.937481 7.29321 1.15982L9.96509 3.40982C10.1022 3.52528 10.1831 3.69404 10.1873 3.87324C10.1915 4.05243 10.1186 4.2248 9.98706 4.34656L7.31518 6.81971C7.06186 7.05419 6.66643 7.03892 6.43196 6.7856C6.19748 6.53228 6.21275 6.13685 6.46607 5.90237L7.9672 4.51289H5.20312C3.68434 4.51289 2.45312 5.74411 2.45312 7.26289V9.51289V11.7629C2.45312 13.2817 3.68434 14.5129 5.20312 14.5129C5.5483 14.5129 5.82812 14.7927 5.82812 15.1379C5.82812 15.4831 5.5483 15.7629 5.20312 15.7629C2.99399 15.7629 1.20312 13.972 1.20312 11.7629V9.51289V7.26289C1.20312 5.05375 2.99399 3.26289 5.20312 3.26289H7.85002L6.48804 2.11596C6.22401 1.89362 6.19021 1.49934 6.41256 1.23531Z" />
                    <path d="M11.5874 17.7904C11.3651 18.0545 10.9708 18.0883 10.7068 17.8659L8.03491 15.6159C7.89781 15.5005 7.81687 15.3317 7.81267 15.1525C7.80847 14.9733 7.8814 14.801 8.01294 14.6792L10.6848 12.206C10.9381 11.9716 11.3336 11.9868 11.568 12.2402C11.8025 12.4935 11.7872 12.8889 11.5339 13.1234L10.0328 14.5129H12.7969C14.3157 14.5129 15.5469 13.2816 15.5469 11.7629V9.51286V7.26286C15.5469 5.74408 14.3157 4.51286 12.7969 4.51286C12.4517 4.51286 12.1719 4.23304 12.1719 3.88786C12.1719 3.54269 12.4517 3.26286 12.7969 3.26286C15.006 3.26286 16.7969 5.05373 16.7969 7.26286V9.51286V11.7629C16.7969 13.972 15.006 15.7629 12.7969 15.7629H10.15L11.512 16.9098C11.776 17.1321 11.8098 17.5264 11.5874 17.7904Z" />
                  </svg>
                </button>
              )}
              {showLikeAction && (
                <button
                  onClick={() => {
                    onLike(item.id);
                  }}
                  disabled={!enableLikeAction}
                >
                  <svg
                    aria-label="Like"
                    role="img"
                    viewBox="0 0 18 18"
                    fill="transparent"
                    stroke="currentColor"
                    style={{ width: "1.4rem", height: "auto" }}
                  >
                    <path
                      d="M1.34375 7.53125L1.34375 7.54043C1.34374 8.04211 1.34372 8.76295 1.6611 9.65585C1.9795 10.5516 2.60026 11.5779 3.77681 12.7544C5.59273 14.5704 7.58105 16.0215 8.33387 16.5497C8.73525 16.8313 9.26573 16.8313 9.66705 16.5496C10.4197 16.0213 12.4074 14.5703 14.2232 12.7544C15.3997 11.5779 16.0205 10.5516 16.3389 9.65585C16.6563 8.76296 16.6563 8.04211 16.6562 7.54043V7.53125C16.6562 5.23466 15.0849 3.25 12.6562 3.25C11.5214 3.25 10.6433 3.78244 9.99228 4.45476C9.59009 4.87012 9.26356 5.3491 9 5.81533C8.73645 5.3491 8.40991 4.87012 8.00772 4.45476C7.35672 3.78244 6.47861 3.25 5.34375 3.25C2.9151 3.25 1.34375 5.23466 1.34375 7.53125Z"
                      strokeWidth="1.25"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
          {/* <div
            css={(t) =>
              css({
                marginTop: "0.6rem",
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.small,
              })
            }
          >
            2 revotes &middot; 12 likes
          </div> */}
        </div>
      </div>
    );
  },
);

const ItemBody = React.memo(
  ({ text, displayImages, truncateLines: enableLineTruncation }) => {
    const containerRef = React.useRef();

    const [isCollapsed_, setCollapsed] = React.useState(enableLineTruncation);
    const [exceedsTruncationThreshold, setExceedsTruncationThreshold] =
      React.useState(null);

    const isEnabled = enableLineTruncation && exceedsTruncationThreshold;
    const isCollapsed = isEnabled && isCollapsed_;

    React.useEffect(() => {
      const observer = new ResizeObserver(() => {
        if (containerRef.current == null) return;
        setExceedsTruncationThreshold(
          containerRef.current.scrollHeight >
            BODY_TRUNCATION_HEIGHT_THRESHOLD + 100,
        );
      });

      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    }, []);

    return (
      <div css={css({ margin: "0.5rem 0" })}>
        <div
          ref={containerRef}
          css={css({ overflow: "hidden" })}
          style={{
            maxHeight: isCollapsed
              ? `${BODY_TRUNCATION_HEIGHT_THRESHOLD}px`
              : undefined,
            maskImage: isCollapsed
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

        {isEnabled && (
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
  },
);

const ItemTitle = ({ item, context }) => {
  const isIsolatedContext = ["proposal", "candidate"].includes(context);

  const proposal = useProposal(item.proposalId ?? item.targetProposalId);
  const candidate = useProposalCandidate(item.candidateId);

  const ContextLink = ({ proposalId, candidateId, short, children }) => {
    if (proposalId != null) {
      const title =
        proposal?.title == null || proposal.title.length > 130
          ? `Proposal ${proposalId}`
          : `${short ? proposalId : `Proposal ${proposalId}`}: ${
              proposal.title
            } `;
      return (
        <NextLink prefetch href={`/proposals/${proposalId}`}>
          {children ?? title}
        </NextLink>
      );
    }

    if (candidateId != null) {
      const title =
        candidate?.latestVersion?.content.title ??
        extractSlugFromCandidateId(candidateId);
      return (
        <NextLink
          prefetch
          href={`/candidates/${encodeURIComponent(
            makeCandidateUrlId(candidateId),
          )}`}
        >
          {children ?? title}
        </NextLink>
      );
    }

    throw new Error();
  };

  const accountName = (
    <AccountPreviewPopoverTrigger
      accountAddress={item.authorAccount}
      fallbackDisplayName={item.authorDisplayName}
    />
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
      const signalWord = (() => {
        const isRepost =
          item.reposts?.length > 0 &&
          item.reposts.every((post) => post.support === item.support);

        if (isRepost) return item.type === "vote" ? "revoted" : "reposted";

        switch (item.type) {
          case "vote":
            return "voted";
          case "feedback-post": {
            if (item.support !== 2) return "signaled";

            const isReplyWithoutAdditionalComment =
              item.replies?.length > 0 &&
              (item.body == null || item.body.trim() === "");

            return isReplyWithoutAdditionalComment ? "replied" : "commented";
          }
          default:
            throw new Error();
        }
      })();
      return (
        <span>
          {accountName}{" "}
          {(() => {
            switch (item.support) {
              case 0:
                return (
                  <Signal negative>
                    {signalWord} against
                    {item.voteCount != null && <> ({item.voteCount})</>}
                  </Signal>
                );
              case 1:
                return (
                  <Signal positive>
                    {signalWord} for
                    {item.voteCount != null && <> ({item.voteCount})</>}
                  </Signal>
                );
              case 2:
                return item.type === "vote" ? (
                  <Signal>
                    abstained
                    {item.voteCount != null && <> ({item.voteCount})</>}
                  </Signal>
                ) : isIsolatedContext ? (
                  signalWord
                ) : (
                  <>{signalWord} on</>
                );
            }
          })()}
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink short {...item} />
            </>
          )}
        </span>
      );
    }

    case "farcaster-cast": {
      if (item.authorAccount == null)
        return (
          <>
            <span css={(t) => css({ fontWeight: t.text.weights.emphasis })}>
              {item.authorDisplayName}
            </span>{" "}
            commented
            {!isIsolatedContext && (
              <>
                {" "}
                on <ContextLink short {...item} />
              </>
            )}
          </>
        );

      return (
        <>
          {accountName} commented{" "}
          {!isIsolatedContext && (
            <>
              {" "}
              on <ContextLink short {...item} />
            </>
          )}
        </>
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
      return <TransferItem item={item} />;

    case "noun-delegated":
      return (
        <>
          {accountName}{" "}
          <span css={(t) => css({ color: t.colors.textDimmed })}>
            delegated <NounsPreviewPopoverTrigger nounIds={item.nouns} /> to{" "}
            <AccountPreviewPopoverTrigger
              showAvatar
              accountAddress={item.toAccount}
            />
          </span>
        </>
      );

    case "noun-undelegated": {
      return (
        <>
          {accountName}{" "}
          <span css={(t) => css({ color: t.colors.textDimmed })}>
            stopped delegating{" "}
            <NounsPreviewPopoverTrigger nounIds={item.nouns} /> to{" "}
            <AccountPreviewPopoverTrigger
              showAvatar
              accountAddress={item.fromAccount}
            />
          </span>
        </>
      );
    }

    default:
      console.log(item);
      throw new Error(`Unknown event type "${item.type}"`);
  }
};

const TransferItem = ({ item }) => {
  const { amount: saleAmount, forkId } = useSaleInfo({
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
        <>
          {accountName}{" "}
          <span css={(t) => css({ color: t.colors.textDimmed })}>
            bought <NounPreviewPopoverTrigger nounId={item.nounId} />
            {nounAuctionAmount && (
              <>
                {" "}
                for{" "}
                <FormattedEthWithConditionalTooltip value={nounAuctionAmount} />
              </>
            )}{" "}
            from the{" "}
            <AccountPreviewPopoverTrigger accountAddress={item.fromAccount}>
              <button
                css={(t) =>
                  css({
                    fontWeight: t.text.weights.smallHeader,
                    outline: "none",
                    "@media(hover: hover)": {
                      cursor: "pointer",
                      ":hover": {
                        textDecoration: "underline",
                      },
                    },
                  })
                }
              >
                Auction house
              </button>
            </AccountPreviewPopoverTrigger>
          </span>
        </>
      );

    case "noun-transferred":
      if (forkId != null) {
        return (
          <>
            {accountName}{" "}
            <span css={(t) => css({ color: t.colors.textDimmed })}>
              joined fork{" "}
              <a
                href={`https://nouns.wtf/fork/${forkId}`}
                target="_blank"
                rel="noreferrer"
              >
                #{forkId}
              </a>{" "}
              with <NounsPreviewPopoverTrigger nounIds={item.nouns} />
            </span>
          </>
        );
      }
      if (saleAmount && saleAmount > 0) {
        if (item.accountRef.toLowerCase() === item.toAccount.toLowerCase()) {
          return (
            <>
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={item.accountRef}
              />{" "}
              <span css={(t) => css({ color: t.colors.textDimmed })}>
                bought <NounsPreviewPopoverTrigger nounIds={item.nouns} /> for{" "}
                <FormattedEthWithConditionalTooltip value={saleAmount} /> from{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={item.fromAccount}
                />{" "}
              </span>
            </>
          );
        } else {
          return (
            <>
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={item.accountRef}
              />{" "}
              <span css={(t) => css({ color: t.colors.textDimmed })}>
                sold <NounsPreviewPopoverTrigger nounIds={item.nouns} /> for{" "}
                <FormattedEthWithConditionalTooltip value={saleAmount} /> to{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={item.toAccount}
                />{" "}
              </span>
            </>
          );
        }
      }

      return (
        <span>
          {accountName}{" "}
          <span css={(t) => css({ color: t.colors.textDimmed })}>
            transferred <NounsPreviewPopoverTrigger nounIds={item.nouns} /> to{" "}
            <AccountPreviewPopoverTrigger
              showAvatar
              accountAddress={item.toAccount}
            />
          </span>
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

const QuotedVoteOrFeedbackPost = ({ href, item, showSignal = false }) => (
  <div
    css={(t) =>
      css({
        position: "relative",
        border: "0.1rem solid",
        borderRadius: "0.5rem",
        borderColor: t.colors.borderLighter,
        padding: "0.4rem 0.6rem",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      })
    }
  >
    <NextLink
      href={href}
      style={{ display: "block", position: "absolute", inset: 0 }}
    />
    <AccountPreviewPopoverTrigger
      showAvatar
      accountAddress={item.voterId}
      style={{ position: "relative" }}
    />
    {showSignal && (
      <span
        css={(t) =>
          css({
            fontWeight: t.text.weights.emphasis,
            "[data-for]": { color: t.colors.textPositive },
            "[data-against]": { color: t.colors.textNegative },
            "[data-abstain]": { color: t.colors.textDimmed },
          })
        }
      >
        {" "}
        {(() => {
          switch (item.support) {
            case 0:
              return <Signal negative>(against)</Signal>;
            case 1:
              return <Signal positive>(for)</Signal>;
            case 2:
              return <Signal>(abstained)</Signal>;
          }
        })()}
      </span>
    )}
    :{" "}
    <MarkdownRichText
      text={item.reason}
      displayImages={false}
      inline
      css={css({
        // Make all headings small
        "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
        "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": { marginTop: "1.5em" },
        "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)": {
          marginBottom: "0.625em",
        },
      })}
    />
  </div>
);

export default ActivityFeed;

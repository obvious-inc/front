import React from "react";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import * as Popover from "@shades/ui-web/popover";
import { useNoun } from "../store.js";
import NounAvatar from "./noun-avatar.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "../hooks/chain-id.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";

const NounPreviewPopoverTrigger = React.forwardRef(
  (
    {
      nounId,
      nounSeed,
      contextAccount,
      popoverPlacement = "bottom",
      children,
      ...props
    },
    triggerRef
  ) => {
    const renderTrigger = () => {
      if (children != null) return children;

      return (
        <button
          ref={triggerRef}
          css={(t) =>
            css({
              outline: "none",
              "[data-id]": {
                fontWeight: t.text.weights.smallHeader,
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  "[data-id]": { textDecoration: "underline" },
                },
              },
            })
          }
        >
          <NounAvatar id={nounId} seed={nounSeed} size="4rem" />
          <div data-id>{nounId}</div>
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content>
          <NounPreview nounId={nounId} contextAccount={contextAccount} />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

const NounEvents = ({ nounId, contextAccount }) => {
  const noun = useNoun(nounId);
  const events = noun?.events ?? [];

  if (!events) return null;

  const latestDelegationEvent = events.find((e) => e.type === "delegate");
  const latestTransferEvent = events.find((e) => e.type === "transfer");

  return (
    <div
      css={(t) =>
        css({
          display: "grid",
          rowGap: "0.4rem",
          padding: "1rem 1.2rem",
          borderTop: "0.1rem solid",
          borderColor: t.colors.borderLighter,
        })
      }
    >
      <NounTransferPreviewText
        nounId={nounId}
        event={latestTransferEvent}
        contextAccount={contextAccount}
      />

      <NounDelegationPreviewText
        nounId={nounId}
        event={latestDelegationEvent}
        contextAccount={contextAccount}
      />
    </div>
  );
};

const NounDelegationPreviewText = ({ nounId, event, contextAccount }) => {
  const noun = useNoun(nounId);
  const { displayName: newAccountDisplayName } = useAccountDisplayName(
    event.newAccountId
  );
  const { displayName: ownerDisplayName } = useAccountDisplayName(noun.ownerId);

  const isDestinationAccount =
    contextAccount != null &&
    event.newAccountId.toLowerCase() === contextAccount.toLowerCase();

  const destinationText = isDestinationAccount ? "from" : "to";

  if (event.newAccountId == noun?.ownerId) return null;

  const previousAccount = isDestinationAccount
    ? ownerDisplayName
    : newAccountDisplayName;

  const previousAccountAddress = isDestinationAccount
    ? noun.ownerId
    : event.newAccountId;

  return (
    <div>
      <span
        css={(t) =>
          css({
            color: isDestinationAccount
              ? t.colors.textPositive
              : t.colors.textNegative,
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        Delegated {destinationText}{" "}
      </span>
      <span>
        <a
          href={`https://etherscan.io/address/${previousAccountAddress}`}
          rel="noreferrer"
          target="_blank"
          css={(t) =>
            css({
              color: "inherit",
              fontWeight: t.text.weights.emphasis,
              textDecoration: "none",
              "@media(hover: hover)": {
                ":hover": {
                  textDecoration: "underline",
                },
              },
            })
          }
        >
          {previousAccount}
        </a>
      </span>{" "}
      since{" "}
      <FormattedDateWithTooltip
        tinyRelative
        disableTooltip
        month="short"
        day="numeric"
        year="numeric"
        value={event.blockTimestamp}
      />
    </div>
  );
};

const NounTransferPreviewText = ({ nounId, event, contextAccount }) => {
  const chainId = useChainId();
  const noun = useNoun(nounId);
  const auction = noun?.auction;

  const { displayName: newAccountDisplayName } = useAccountDisplayName(
    event.newAccountId
  );
  const { displayName: previousAccountDisplayName } = useAccountDisplayName(
    event.previousAccountId
  );
  const { displayName: ownerDisplayName } = useAccountDisplayName(noun.ownerId);

  const isDestinationAccount =
    contextAccount != null &&
    event.newAccountId.toLowerCase() === contextAccount.toLowerCase();

  if (!isDestinationAccount) return null;

  const transferredFromAuction =
    event.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "auction-house").address.toLowerCase();
  const transferredFromProposalExecution =
    event.previousAccountId.toLowerCase() ===
    resolveIdentifier(chainId, "executor").address.toLowerCase();

  const previousAccount = isDestinationAccount
    ? previousAccountDisplayName
    : newAccountDisplayName;

  const previousAccountAddress = isDestinationAccount
    ? event.previousAccountId
    : event.newAccountId;

  const transferredFromText = transferredFromAuction
    ? "Auction House"
    : transferredFromProposalExecution
    ? "Nouns Treasury"
    : previousAccount;

  return (
    <div>
      <span
        css={(t) =>
          css({
            fontWeight: t.text.weights.emphasis,
          })
        }
      >
        Transferred
      </span>{" "}
      from{" "}
      <span>
        <a
          href={`https://etherscan.io/address/${previousAccountAddress}`}
          rel="noreferrer"
          target="_blank"
          css={(t) =>
            css({
              color: "inherit",
              fontWeight: t.text.weights.emphasis,
              textDecoration: "none",
              "@media(hover: hover)": {
                ":hover": {
                  textDecoration: "underline",
                },
              },
            })
          }
        >
          {transferredFromText}
        </a>
      </span>{" "}
      on{" "}
      <FormattedDateWithTooltip
        disableRelative
        disableTooltip
        month="short"
        day="numeric"
        year="numeric"
        value={event.blockTimestamp}
      />
    </div>
  );
};

const NounPreview = React.forwardRef(({ nounId, contextAccount }, ref) => {
  const noun = useNoun(nounId);
  const firstEvent = noun?.events?.[noun.events.length - 1];

  const auction = noun?.auction;
  const nounTimestamp = auction?.startTime ?? firstEvent?.blockTimestamp;

  return (
    <div
      ref={ref}
      css={css({
        width: "32rem",
        minWidth: 0,
        borderRadius: "0.4rem",
        overflow: "hidden",
      })}
    >
      <div
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            padding: "1rem 1.2rem",
            gap: "1rem",
            color: t.colors.textDimmed,
          })
        }
      >
        <NounAvatar id={nounId} seed={noun.seed} size="4rem" />
        <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
          <a
            href={`https://nouns.wtf/noun/${nounId}`}
            rel="noreferrer"
            target="_blank"
            css={(t) =>
              css({
                fontWeight: t.text.weights.smallHeader,
                color: "inherit",
                textDecoration: "none",
                "@media(hover: hover)": {
                  ':hover [data-hover-underline="true"]': {
                    textDecoration: "underline",
                  },
                },
              })
            }
          >
            <div data-hover-underline="true">Noun {nounId}</div>
          </a>

          <div>
            <FormattedDateWithTooltip
              disableRelative
              disableTooltip
              month="short"
              day="numeric"
              year="numeric"
              value={nounTimestamp}
            />
          </div>
          {auction?.amount && (
            <div>
              <FormattedEthWithConditionalTooltip value={auction?.amount} />
            </div>
          )}
        </div>
      </div>
      <NounEvents nounId={nounId} contextAccount={contextAccount} />
    </div>
  );
});

export default NounPreviewPopoverTrigger;

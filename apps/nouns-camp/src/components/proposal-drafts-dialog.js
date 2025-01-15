import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { array as arrayUtils } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Button from "@shades/ui-web/button";
import { Plus as PlusIcon } from "@shades/ui-web/icons";
import { isNodeEmpty as isRichTextNodeEmpty } from "@shades/ui-web/rich-text-editor";
import { useCollection as useDrafts } from "../hooks/drafts.js";
import ProposalList from "./proposal-list.js";

const ProposalDraftsDialog = ({ isOpen, close }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="54rem"
    >
      {(props) => <Content dismiss={close} {...props} />}
    </Dialog>
  );
};

const Content = ({ titleProps, dismiss }) => {
  const { items: drafts } = useDrafts();
  const proposalDrafts = drafts.filter((d) => !d.type || d.type === "draft");

  const filteredSortedProposalDrafts = React.useMemo(() => {
    if (proposalDrafts == null) return [];
    const filteredItems = proposalDrafts.filter((d) => {
      if (d.name.trim() !== "") return true;
      return d.body.some((n) => !isRichTextNodeEmpty(n, { trim: true }));
    });
    return arrayUtils.sortBy(
      { value: (i) => Number(i.id), order: "desc" },
      filteredItems.map((i) => ({ ...i, type: "draft" })),
    );
  }, [proposalDrafts]);

  const hasDrafts = filteredSortedProposalDrafts.length > 0;

  const info =
    "Drafts are stored in your browser, and can’t be seen by anyone else";

  return (
    <div
      css={css({
        padding: "1.6rem",
        "@media (min-width: 600px)": {
          padding: "2rem",
        },
      })}
    >
      <DialogHeader
        title="Proposal drafts"
        subtitle={hasDrafts ? info : null}
        titleProps={titleProps}
        dismiss={dismiss}
      />
      <main>
        {hasDrafts ? (
          <ProposalList items={filteredSortedProposalDrafts} />
        ) : (
          <div
            css={(t) =>
              css({
                textAlign: "center",
                color: t.colors.textDimmed,
                padding: "2.4rem 3.2rem 4rem",
                h3: {
                  fontSize: t.text.sizes.larger,
                  fontWeight: t.text.weights.normal,
                  margin: "0 0 0.8rem",
                },
              })
            }
          >
            <h3>No drafts</h3>
            <p>{info}</p>
            <Button
              component={NextLink}
              href="/new"
              prefetch
              variant="primary"
              icon={<PlusIcon style={{ width: "1.2rem" }} />}
              style={{ marginTop: "3.2rem" }}
            >
              New proposal
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProposalDraftsDialog;

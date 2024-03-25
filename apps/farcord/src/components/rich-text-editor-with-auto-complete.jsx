import React from "react";
import { css } from "@emotion/react";
import { emoji as emojiUtils } from "@shades/common/utils";
import { useEmojis } from "@shades/common/app";
import RichTextEditor from "./rich-text-editor";
import Avatar from "@shades/ui-web/avatar";
import useFarcasterAccount from "./farcaster-account";
import { useSearchUsersByUsername } from "../hooks/neynar";

const RichTextEditorWithAutoComplete = React.forwardRef(
  (
    {
      initialValue,
      onChange,
      placeholder,
      onKeyDown,
      disabled,
      inline = false,
      ...props
    },
    editorRef,
  ) => {
    const preventInputBlurRef = React.useRef();
    const mentionQueryRangeRef = React.useRef();
    const emojiQueryRangeRef = React.useRef();
    const [mentionQuery, setMentionQuery] = React.useState(null);
    const [emojiQuery, setEmojiQuery] = React.useState(null);
    const [selectedAutoCompleteIndex, setSelectedAutoCompleteIndex] =
      React.useState(-1);

    const { fid } = useFarcasterAccount();

    const autoCompleteMode = (() => {
      if (mentionQuery != null) return "mentions";
      if (emojiQuery != null) return "emojis";
      return null;
    })();

    const { allEntries: emojis, recentlyUsedEntries: recentEmojis } = useEmojis(
      { enabled: autoCompleteMode === "emojis" },
    );

    const isAutoCompleteMenuOpen = autoCompleteMode != null;

    const matchedUsers = useSearchUsersByUsername({
      fid,
      query: mentionQuery,
      enabled: autoCompleteMode == "mentions",
    });

    const filteredMentionOptions = React.useMemo(() => {
      if (autoCompleteMode !== "mentions") return [];

      return matchedUsers?.slice(0, 10).map((m) => {
        const label = m.displayName || m.display_name;
        return {
          value: m.fid,
          label,
          description: `@${m.username}`,
          image: <Avatar url={m.pfpUrl} size={"3.2rem"} />,
        };
      });
    }, [autoCompleteMode, matchedUsers]);

    const filteredEmojiOptions = React.useMemo(() => {
      if (autoCompleteMode !== "emojis") return [];

      const query = emojiQuery ?? null;

      const lowerCaseQuery = emojiQuery?.trim().toLowerCase();

      const getDefaultSet = () =>
        recentEmojis.length === 0 ? emojis : recentEmojis;

      const orderedFilteredEmojis =
        emojiQuery.trim() === ""
          ? getDefaultSet()
          : emojiUtils.search(emojis, query);

      return orderedFilteredEmojis.slice(0, 10).map((e) => {
        const [firstAlias, ...otherAliases] = [...e.aliases, ...e.tags];
        const visibleAliases = [
          firstAlias,
          ...otherAliases.filter(
            (a) => lowerCaseQuery !== "" && a.includes(lowerCaseQuery),
          ),
        ];
        return {
          value: e.emoji,
          label: (
            <span>
              <span
                style={{
                  display: "inline-flex",
                  transform: "scale(1.35)",
                  marginRight: "0.5rem",
                }}
              >
                {e.emoji}
              </span>{" "}
              {visibleAliases.map((a, i) => {
                const isMatch = a.includes(lowerCaseQuery);
                const matchStartIndex = isMatch && a.indexOf(lowerCaseQuery);
                const matchEndIndex =
                  isMatch && a.indexOf(lowerCaseQuery) + lowerCaseQuery.length;
                return (
                  <React.Fragment key={a}>
                    {i !== 0 && " "}:
                    {isMatch ? (
                      <>
                        {a.slice(0, matchStartIndex)}
                        <span data-matching-text="true">
                          {a.slice(matchStartIndex, matchEndIndex)}
                        </span>
                        {a.slice(matchEndIndex)}
                      </>
                    ) : (
                      a
                    )}
                    :
                  </React.Fragment>
                );
              })}
            </span>
          ),
        };
      });
    }, [emojis, recentEmojis, autoCompleteMode, emojiQuery]);

    const autoCompleteOptions = {
      mentions: filteredMentionOptions,
      emojis: filteredEmojiOptions,
    }[autoCompleteMode];

    const selectAutoCompleteOption = React.useCallback(
      (option) => {
        switch (autoCompleteMode) {
          case "mentions":
            editorRef.current.insertMention(option.value, {
              at: mentionQueryRangeRef.current,
            });
            setMentionQuery(null);
            break;

          case "emojis":
            editorRef.current.insertEmoji(option.value, {
              at: emojiQueryRangeRef.current,
            });
            setEmojiQuery(null);
            break;

          default:
            throw new Error();
        }
      },
      [autoCompleteMode, editorRef, mentionQueryRangeRef],
    );

    const autoCompleteInputKeyDownHandler = React.useCallback(
      (event) => {
        if (!isAutoCompleteMenuOpen || autoCompleteOptions.length === 0) return;

        switch (event.key) {
          case "ArrowDown": {
            event.preventDefault();
            setSelectedAutoCompleteIndex((i) =>
              i >= autoCompleteOptions.length - 1 ? 0 : i + 1,
            );
            break;
          }
          case "ArrowUp": {
            event.preventDefault();
            setSelectedAutoCompleteIndex((i) =>
              i <= 0 ? autoCompleteOptions.length - 1 : i - 1,
            );
            break;
          }
          case "Tab":
          case "Enter": {
            const option = autoCompleteOptions[selectedAutoCompleteIndex];
            event.preventDefault();
            selectAutoCompleteOption(option);
            break;
          }
          case "Escape":
            event.preventDefault();
            setMentionQuery(null);
            setEmojiQuery(null);
            break;
        }
      },
      [
        isAutoCompleteMenuOpen,
        autoCompleteOptions,
        selectedAutoCompleteIndex,
        selectAutoCompleteOption,
      ],
    );

    const autoCompleteInputAccesibilityProps = {
      "aria-expanded": isAutoCompleteMenuOpen ? "true" : "false",
      "aria-haspopup": "listbox",
      "aria-autocomplete": "list",
      "aria-owns": "autocomplete-listbox",
      "aria-controls": "autocomplete-listbox",
      "aria-activedescendant": `autocomplete-listbox-option-${selectedAutoCompleteIndex}`,
    };

    return (
      <>
        <RichTextEditor
          ref={editorRef}
          {...autoCompleteInputAccesibilityProps}
          inline={inline}
          value={initialValue}
          onChange={onChange}
          disabled={disabled}
          placeholder={placeholder}
          triggers={[
            {
              type: "word",
              handler: (word, range) => {
                if (word.startsWith("@")) {
                  setMentionQuery(word.slice(1));
                  setSelectedAutoCompleteIndex(0);
                  mentionQueryRangeRef.current = range;
                  return;
                }

                setMentionQuery(null);
              },
            },
            {
              type: "word",
              handler: (word, range) => {
                if (word.startsWith(":")) {
                  setEmojiQuery(word.slice(1));
                  setSelectedAutoCompleteIndex(0);
                  emojiQueryRangeRef.current = range;
                  return;
                }

                setEmojiQuery(null);
              },
            },
          ].filter(Boolean)}
          onKeyDown={(e) => {
            autoCompleteInputKeyDownHandler(e);

            if (onKeyDown) onKeyDown(e);
          }}
          onBlur={() => {
            if (preventInputBlurRef.current) {
              preventInputBlurRef.current = false;
              editorRef.current.focus();
              return;
            }

            setMentionQuery(null);
            setEmojiQuery(null);
          }}
          css={(t) =>
            css({
              outline: "none",
              color: t.colors.textNormal,
              "&[data-disabled]": {
                color: t.colors.textMuted,
                cursor: "not-allowed",
                "[data-slate-placeholder]": {
                  color: t.colors.textMuted,
                },
              },
              "[data-slate-placeholder]": {
                color: t.colors.inputPlaceholder,
                opacity: "1 !important",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                top: 0,
              },
            })
          }
          {...props}
        />

        {isAutoCompleteMenuOpen && autoCompleteOptions.length !== 0 && (
          <AutoCompleteListbox
            items={autoCompleteOptions}
            selectedIndex={selectedAutoCompleteIndex}
            onItemClick={(item) => {
              selectAutoCompleteOption(item);
            }}
            onListboxMouseDown={() => {
              preventInputBlurRef.current = true;
            }}
          />
        )}
      </>
    );
  },
);

const AutoCompleteListbox = ({
  selectedIndex = -1,
  onItemClick,
  items = [],
  onListboxMouseDown,
}) => {
  return (
    <ul
      onMouseDown={onListboxMouseDown}
      id="autocomplete-listbox"
      role="listbox"
      css={(theme) =>
        css({
          position: "absolute",
          bottom: "calc(100% + 0.5rem)",
          left: 0,
          width: "100%",
          zIndex: 1,
          background: theme.colors.popoverBackground,
          borderRadius: "0.7rem",
          padding: "0.5rem 0",
          boxShadow: theme.shadows.elevationLow,
          "[role=option]": {
            display: "flex",
            alignItems: "center",
            width: "100%",
            padding: "0.8rem 1.2rem 0.6rem",
            lineHeight: 1.3,
            fontWeight: "400",
            cursor: "pointer",
            outline: "none",
            ".image": {
              width: "3.2rem",
              height: "3.2rem",
              borderRadius: "50%",
              overflow: "hidden",
              marginRight: "1rem",
            },
            ".label": {
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "flex-start",
              height: "1.8rem",
              color: theme.colors.textNormal,
            },
            ".description": {
              color: theme.colors.textDimmed,
              fontSize: "1.2rem",
              whiteSpace: "pre-line",
            },
            '[data-matching-text="true"]': {
              color: theme.colors.textHeader,
              background: theme.colors.textHighlightBackground,
            },
            '&:hover, &:focus, &[data-selected="true"]': {
              background: theme.colors.backgroundModifierHover,
              ".label": {
                color: theme.colors.textHeader,
              },
            },
          },
        })
      }
    >
      {items.map((item, i) => (
        <li
          key={item.value}
          role="option"
          id={`autocomplete-listbox-option-${selectedIndex}`}
          aria-selected={`${i === selectedIndex}`}
          data-selected={`${i === selectedIndex}`}
          onClick={() => {
            onItemClick(item, i);
          }}
        >
          {typeof item.render === "function" ? (
            item.render({})
          ) : (
            <>
              {item.image && <div className="image">{item.image}</div>}
              <div>
                <div className="label">{item.label}</div>
                {item.description && (
                  <div className="description">{item.description}</div>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
};

export default RichTextEditorWithAutoComplete;

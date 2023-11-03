import React from "react";
import { css } from "@emotion/react";
import {
  createEditor as createSlateEditor,
  Transforms,
  Editor,
  Range,
} from "slate";
import { Slate, Editable, withReact, ReactEditor } from "slate-react";
import { withHistory } from "slate-history";
import isHotkey from "is-hotkey";
import {
  function as functionUtils,
  url as urlUtils,
  requestIdleCallback,
  getImageDimensionsFromUrl,
} from "@shades/common/utils";
import { ErrorBoundary } from "@shades/common/react";
import Select from "./select.js";
import { createCss as createRichTextCss } from "./rich-text.js";
import createControlledParagraphLineBreaksPlugin from "./slate/plugins/controlled-paragraph-line-breaks.js";
import createSensibleVoidsPlugin from "./slate/plugins/sensible-voids.js";
import createListsPlugin from "./slate/plugins/lists.js";
import createQuotesPlugin from "./slate/plugins/quotes.js";
import createCodeBlocksPlugin from "./slate/plugins/code-blocks.js";
// import createCalloutsPlugin from "./slate/plugins/callouts.js";
import createHorizontalDividerPlugin from "./slate/plugins/horizontal-divider.js";
import createEmojiPlugin from "./slate/plugins/emojis.js";
import createInlineLinksPlugin from "./slate/plugins/inline-links.js";
import createImagesPlugin from "./slate/plugins/images.js";
import createHeadingsPlugin from "./slate/plugins/headings.js";
import createUserMentionsPlugin from "./slate/plugins/user-mentions.js";
import createChannelLinksPlugin from "./slate/plugins/channel-link.js";
import { search, mergePlugins } from "./slate/utils.js";

const FormDialog = React.lazy(() => import("./form-dialog.js"));
const Dialog = React.lazy(() => import("./dialog.js"));

export {
  isNodeEmpty,
  toMessageBlocks,
  fromMessageBlocks,
} from "./slate/utils.js";

const { compose } = functionUtils;

const markHotkeys = {
  "mod+b": "bold",
  "mod+i": "italic",
  "mod+shift+x": "strikethrough",
};

const Context = React.createContext();

export const Provider = ({ children }) => {
  const editorRef = React.useRef();
  const [linkDialogState, linkDialogActions] = useLinkDialog({ editorRef });
  const [imageDialogState, imageDialogActions] = useImageDialog({ editorRef });
  const [selection, setSelection] = React.useState(null);
  const [activeMarks, setActiveMarks] = React.useState([]);

  const contextValue = React.useMemo(
    () => ({
      editorRef,
      linkDialogState,
      linkDialogActions,
      imageDialogState,
      imageDialogActions,
      selection,
      setSelection,
      activeMarks,
      setActiveMarks,
    }),
    [
      linkDialogState,
      linkDialogActions,
      imageDialogState,
      imageDialogActions,
      editorRef,
      selection,
      setSelection,
      activeMarks,
      setActiveMarks,
    ]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

const useLinkDialog = ({ editorRef }) => {
  const [state, setState] = React.useState(null);

  const open = React.useCallback(() => {
    const editor = editorRef.current;
    const linkMatch = editor.above({ match: (n) => n.type === "link" });

    if (linkMatch == null) {
      const selectedText =
        editor.selection == null || Range.isCollapsed(editor.selection)
          ? null
          : editor.string(editor.selection).trim();
      setState({
        label: selectedText,
        url: null,
        selection: editor.selection,
      });
      return;
    }

    const linkElement = linkMatch[0];

    setState({
      label: linkElement.label ?? "",
      url: linkElement.url ?? "",
      selection: editor.selection,
    });
  }, [editorRef]);

  const close = React.useCallback(() => {
    setState(null);
  }, []);

  return React.useMemo(
    () => [
      { ...state, isOpen: state != null },
      { open, close },
    ],
    [state, open, close]
  );
};

const useImageDialog = ({ editorRef }) => {
  const [state, setState] = React.useState(null);

  const open = React.useCallback(
    (at_) => {
      const editor = editorRef.current;
      const at = at_ ?? editor.selection;

      if (at == null) throw new Error();

      const [node] = editor.node(at) ?? [];

      setState({ url: node?.url, at });
    },
    [editorRef]
  );

  const close = React.useCallback(() => {
    setState(null);
  }, []);

  return React.useMemo(
    () => [
      { ...state, isOpen: state != null },
      { open, close },
    ],
    [state, open, close]
  );
};

const withMarks = (editor) => {
  const isMarkActive = (format) => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
  };

  editor.toggleMark = (format) => {
    const isActive = isMarkActive(format);

    if (isActive) {
      Editor.removeMark(editor, format);
      return;
    }

    Editor.addMark(editor, format, true);
  };

  return editor;
};

const withTextCommands = (editor) => {
  const findWordStart = (p = editor.selection.anchor) => {
    const prevPoint = Editor.before(editor, p, { unit: "offset" });
    if (prevPoint == null) return p;
    const char = editor.string(Editor.range(editor, prevPoint, p));
    if (char === "" || char.match(/\s/)) return p;
    return findWordStart(prevPoint);
  };

  const findWordEnd = (p = editor.selection.anchor) => {
    const nextPoint = Editor.after(editor, p, { unit: "offset" });
    if (nextPoint == null) return p;
    const char = Editor.string(editor, Editor.range(editor, p, nextPoint));
    if (char === "" || char.match(/\s/)) return p;
    return findWordEnd(nextPoint);
  };

  editor.getWordRange = (p = editor.selection.focus) => ({
    anchor: findWordStart(p),
    focus: findWordEnd(p),
  });

  // editor.select = (target) => Transforms.select(editor, target);

  editor.search = (query, { at }) => search(editor, query, { at });

  editor.replaceAll = (text) => {
    Transforms.select(editor, []);
    editor.insertText(text);
  };

  editor.replaceFirstWord = (text) => {
    const p = Editor.edges(editor, [])[0];
    const wordRange = editor.getWordRange(p);
    Transforms.select(editor, wordRange);
    editor.insertText(text);
  };

  editor.replaceCurrentWord = (text) => {
    const wordRange = editor.getWordRange();
    Transforms.select(editor, wordRange);
    editor.insertText(text);
  };

  editor.appendText = (text) => {
    Transforms.select(editor, []);
    Transforms.collapse(editor, { edge: "end" });
    editor.insertText(text);
  };

  editor.prependText = (text) => {
    Transforms.select(editor, []);
    Transforms.collapse(editor, { edge: "start" });
    editor.insertText(text);
  };

  return editor;
};

const withEditorCommands = (editor) => {
  const { string } = editor;

  editor.focus = (location) => {
    return new Promise((resolve) => {
      // Whatever works
      requestIdleCallback(() => {
        editor.select(location ?? editor.end([]));
        ReactEditor.focus(editor);
        resolve();
      });
    });
  };

  editor.clear = () => {
    editor.children = [{ type: "paragraph", children: [{ text: "" }] }];
    // Move cursor to start
    editor.select(editor.start([]));
  };

  editor.string = (location = [], options) => string(location, options);

  editor.print = () => console.log(JSON.stringify(editor.children, null, 2));

  return editor;
};

const withSaneishDefaultBehaviors = (editor) => {
  const { insertData, isInline } = editor;

  editor.insertData = (data) => {
    const text = data.getData("text");

    if (text) {
      editor.insertText(text);
      return;
    }

    insertData(data);
  };

  editor.isInline = (node) =>
    (node.children == null && node.text != null) || isInline(node);

  return editor;
};

const RichTextEditor = React.forwardRef(
  (
    {
      value,
      onChange,
      onKeyDown,
      onBlur,
      onFocus,
      disabled = false,
      inline = false,
      triggers = [],
      imagesMaxWidth,
      imagesMaxHeight,
      ...props
    },
    ref
  ) => {
    const {
      editorRef: internalEditorRef,
      linkDialogState,
      linkDialogActions,
      imageDialogState,
      imageDialogActions,
      setSelection,
      setActiveMarks,
    } = React.useContext(Context);

    const { editor, handlers, customElementsByNodeType } = React.useMemo(() => {
      const editor = compose(
        withMarks,
        withTextCommands,
        withSaneishDefaultBehaviors,
        withEditorCommands,
        withReact,
        withHistory
      )(createSlateEditor());

      const { middleware, elements, handlers } = mergePlugins([
        createCodeBlocksPlugin(),
        createControlledParagraphLineBreaksPlugin(),
        createHeadingsPlugin({ inline }),
        createHorizontalDividerPlugin(),
        createImagesPlugin({ inline }),
        createUserMentionsPlugin(),
        createChannelLinksPlugin(),
        createInlineLinksPlugin(),
        createEmojiPlugin(),
        createListsPlugin({ inline }),
        createQuotesPlugin({ inline }),
        createSensibleVoidsPlugin(),
      ]);

      return {
        editor: middleware(editor),
        customElementsByNodeType: elements,
        handlers,
      };
    }, [inline]);

    const renderElement = (props_) => {
      const props =
        props_.element.type === "link"
          ? {
              ...props_,
              openEditDialog: () => {
                linkDialogActions.open();
              },
            }
          : props_.element.type === "image"
          ? {
              ...props_,
              maxWidth: imagesMaxWidth,
              maxHeight: imagesMaxHeight,
              openEditDialog: () => {
                const nodePath = ReactEditor.findPath(editor, props_.element);
                imageDialogActions.open(nodePath);
              },
            }
          : props_;

      const CustomComponent = customElementsByNodeType[props.element.type];

      return CustomComponent == null ? (
        <Element {...props} />
      ) : (
        <CustomComponent {...props} />
      );
    };

    const renderLeaf = React.useCallback((props) => <Leaf {...props} />, []);

    React.useEffect(() => {
      if (ref != null) ref.current = editor;
      internalEditorRef.current = editor;
      // :this-is-fine:
      editor.normalize({ force: true });
    }, [ref, internalEditorRef, editor, onChange]);

    return (
      <>
        <Slate
          editor={editor}
          initialValue={value}
          onChange={(value) => {
            handlers.onChange(value, editor);
            const marks = editor.getMarks();
            setActiveMarks(marks == null ? [] : Object.keys(marks));
            setSelection(editor.selection);
            onChange?.(value, editor);

            for (let trigger of triggers) {
              switch (trigger.type) {
                case "word": {
                  if (
                    editor.selection == null ||
                    !Range.isCollapsed(editor.selection)
                  )
                    continue;

                  const wordRange = editor.getWordRange();
                  const wordString = Editor.string(editor, wordRange, {
                    voids: true,
                  });

                  if (trigger.match == null || trigger.match(wordString))
                    trigger.handler(wordString, wordRange);

                  break;
                }

                case "command": {
                  if (
                    editor.selection == null ||
                    !Range.isCollapsed(editor.selection)
                  )
                    continue;

                  const string = Editor.string(editor, []);

                  const isCommand = string
                    .split(" ")[0]
                    .match(/^\/([a-z][a-z-]*)?$/);

                  if (!isCommand) {
                    trigger.handler(null);
                    break;
                  }

                  const parts = string.slice(1).split(" ");
                  const [command, ...args] = parts;
                  trigger.handler(
                    command,
                    args.map((a) => a.trim()).filter(Boolean)
                  );

                  break;
                }

                default:
                  throw new Error();
              }
            }
          }}
        >
          <Editable
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            onKeyDown={(e) => {
              handlers.onKeyDown(e, editor);

              for (const hotkey in markHotkeys) {
                if (isHotkey(hotkey, e)) {
                  e.preventDefault();
                  const mark = markHotkeys[hotkey];
                  editor.toggleMark(mark);
                }
              }

              if (onKeyDown) onKeyDown(e);
            }}
            onBlur={(e) => {
              setSelection(null);
              setActiveMarks([]);
              onBlur?.(e);
            }}
            onFocus={(e) => {
              const marks = editor.getMarks();
              setActiveMarks(marks == null ? [] : Object.keys(marks));
              setSelection(editor.selection);
              onFocus?.(e);
            }}
            css={(theme) => {
              const styles = createRichTextCss(theme);
              return css({
                ...styles,
                outline: "none",
                "a:hover": { textDecoration: "none" },
                "&[data-disabled]": {
                  color: theme.colors.textMuted,
                  cursor: "not-allowed",
                  "[data-slate-placeholder]": {
                    color: theme.colors.textMuted,
                  },
                },
                "[data-slate-placeholder]": {
                  color: theme.colors.inputPlaceholder,
                  opacity: "1 !important",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  top: 0,
                },
              });
            }}
            readOnly={disabled}
            data-disabled={disabled || undefined}
            {...props}
          />
        </Slate>

        {linkDialogState.isOpen && (
          <ErrorBoundary
            fallback={() => {
              window.location.reload();
            }}
          >
            <React.Suspense fallback={null}>
              <Dialog
                isOpen
                onRequestClose={() => {
                  linkDialogActions.close();
                  editor.focus(linkDialogState.selection);
                }}
              >
                {({ titleProps }) => (
                  <LinkDialog
                    titleProps={titleProps}
                    dismiss={() => {
                      linkDialogActions.close();
                      editor.focus(linkDialogState.selection);
                    }}
                    initialLabel={linkDialogState.label}
                    initialUrl={linkDialogState.url}
                    onSubmit={async ({ label, url }) => {
                      linkDialogActions.close();
                      await editor.focus(linkDialogState.selection);
                      editor.insertLink(
                        { label, url },
                        { at: linkDialogState.selection }
                      );
                    }}
                  />
                )}
              </Dialog>
            </React.Suspense>
          </ErrorBoundary>
        )}

        {imageDialogState.isOpen && (
          <ErrorBoundary
            fallback={() => {
              window.location.reload();
            }}
          >
            <React.Suspense fallback={null}>
              <Dialog
                isOpen
                onRequestClose={() => {
                  imageDialogActions.close();
                  editor.focus(imageDialogState.at);
                }}
              >
                {({ titleProps }) => (
                  <ImageDialog
                    titleProps={titleProps}
                    dismiss={() => {
                      imageDialogActions.close();
                      editor.focus(imageDialogState.at);
                    }}
                    initialUrl={imageDialogState.url}
                    onSubmit={async ({ url }) => {
                      imageDialogActions.close();
                      const [{ width, height }] = await Promise.all([
                        getImageDimensionsFromUrl(url),
                        editor.focus(imageDialogState.at),
                      ]);
                      editor.insertImage(
                        { url, width, height },
                        { at: imageDialogState.at }
                      );
                    }}
                  />
                )}
              </Dialog>
            </React.Suspense>
          </ErrorBoundary>
        )}
      </>
    );
  }
);

const Element = (props) => {
  const { attributes, children, element } = props;

  switch (element.type) {
    case "heading-1":
      return <h1 {...attributes}>{children}</h1>;

    case "heading-2":
      return <h2 {...attributes}>{children}</h2>;

    case "heading-3":
      return <h3 {...attributes}>{children}</h3>;

    case "bulleted-list":
      return <ul {...attributes}>{children}</ul>;

    case "numbered-list":
      return <ol {...attributes}>{children}</ol>;

    case "list-item":
      return <li {...attributes}>{children}</li>;

    case "quote":
      return <blockquote {...attributes}>{children}</blockquote>;

    case "callout":
      return <aside {...attributes}>{children}</aside>;

    case "paragraph":
      return <p {...attributes}>{children}</p>;

    case "code-block":
      return (
        <pre {...attributes}>
          <code>{children}</code>
        </pre>
      );

    default:
      console.warn(`Unsupported element type "${element.type}"`);
      return <p {...attributes}>{children}</p>;
  }
};

const Leaf = ({ attributes, children, leaf }) => {
  if (leaf.bold) children = <strong>{children}</strong>;
  if (leaf.italic) children = <em>{children}</em>;
  if (leaf.strikethrough) children = <s>{children}</s>;

  return <span {...attributes}>{children}</span>;
};

export const Toolbar = ({ disabled: disabled_, ...props }) => {
  const context = React.useContext(Context);

  if (context == null)
    throw new Error("`Toolbar` rendered without a parent `EditorProvider`");

  const {
    editorRef,
    selection,
    activeMarks,
    linkDialogActions,
    imageDialogActions,
  } = context;

  const [storedSelectionRangeRef, setStoredSelectionRangeRef] =
    React.useState(null);

  const disabled =
    storedSelectionRangeRef == null && (disabled_ || selection == null);

  const selectedNodeEntry = editorRef.current?.above({
    match: editorRef.current.isBlock,
  });
  const [selectedBlockNode, selectedBlockPath] = selectedNodeEntry ?? [];

  const inlineElementsAllowed =
    selectedBlockNode?.type != null &&
    !selectedBlockNode.type.startsWith("heading-") &&
    selectedBlockNode.type !== "code-block";

  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          '[role="separator"]': {
            width: "0.1rem",
            height: "2rem",
            background: t.colors.borderLight,
            margin: "0 0.5rem",
          },
          "[data-button]": {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.6rem",
            height: "2.6rem",
            borderRadius: "0.3rem",
            ":disabled": { color: t.colors.textMuted },
            "@media(hover: hover)": {
              ":not(:disabled)": {
                cursor: "pointer",
                ":hover": {
                  background: t.colors.backgroundModifierHover,
                },
              },
            },
            '&[data-active="true"]': { color: t.colors.textPrimary },
          },
        })
      }
      {...props}
    >
      {[
        selectedBlockNode != null && [
          {
            key: "block-type",
            type: "select",
            props: {
              "aria-label": "Block type select",
              disabled,
              value: selectedBlockNode.type,
              fullWidth: false,
              width: "max-content",
              variant: "transparent",
              size: "small",
              onBlur: () => {
                storedSelectionRangeRef?.unref();
                setStoredSelectionRangeRef(null);
              },
              onFocus: () => {
                setStoredSelectionRangeRef(
                  editorRef.current.rangeRef(editorRef.current.selection)
                );
              },
              onChange: (value) => {
                const editor = editorRef.current;

                if (selectedBlockNode.type === "list-item") {
                  Editor.withoutNormalizing(editorRef.current, () => {
                    editor.setNodes({ type: value });
                    editor.unwrapNodes({
                      at: selectedBlockPath,
                      match: (n) =>
                        ["bulleted-list", "numbered-list"].includes(n.type),
                      split: true,
                    });
                  });
                } else {
                  editor.setNodes({ type: value });
                }

                editor.focus(storedSelectionRangeRef.current);
                storedSelectionRangeRef.unref();
                setStoredSelectionRangeRef(null);
              },
              options: [
                { value: "paragraph", label: "Text" },
                { value: "heading-1", label: "Heading 1" },
                { value: "heading-2", label: "Heading 2" },
                { value: "heading-3", label: "Heading 3" },
                { value: "code-block", label: "Code" },
                { value: "quote", label: "Quote" },
                selectedBlockNode.type === "list-item" && {
                  value: "list-item",
                  label: "List item",
                },
              ].filter(Boolean),
            },
          },
        ],
        [
          {
            key: "bold",
            icon: "B",
            isActive: activeMarks.includes("bold"),
            props: {
              disabled: disabled || !inlineElementsAllowed,
              "data-active": activeMarks.includes("bold"),
              style: { fontWeight: "700" },
              onMouseDown: (e) => {
                e.preventDefault();
                editorRef.current.toggleMark("bold");
              },
            },
          },
          {
            key: "italic",
            icon: "i",
            props: {
              disabled: disabled || !inlineElementsAllowed,
              "data-active": activeMarks.includes("italic"),
              style: { fontStyle: "italic" },
              onMouseDown: (e) => {
                e.preventDefault();
                editorRef.current.toggleMark("italic");
              },
            },
          },
          {
            key: "strikethrough",
            icon: "S",
            props: {
              disabled: disabled || !inlineElementsAllowed,
              "data-active": activeMarks.includes("strikethrough"),
              style: { TextDecoration: "line-through" },
              onMouseDown: (e) => {
                e.preventDefault();
                editorRef.current.toggleMark("strikethrough");
              },
            },
          },
        ],
        // [
        //   {
        //     key: "bulleted-list",
        //     icon: (
        //       <svg viewBox="0 0 20 20" style={{ width: "1.4rem" }}>
        //         <path
        //           fill="currentColor"
        //           fillRule="evenodd"
        //           clipRule="evenodd"
        //           d="M4 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3 0a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5h-10A.75.75 0 0 1 7 3Zm.75 6.25a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10Zm0 7a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10ZM3 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        //         />
        //       </svg>
        //     ),
        //     props: {
        //       disabled: true,
        //       onMouseDown: (e) => {
        //         e.preventDefault();
        //       },
        //     },
        //   },
        //   {
        //     key: "numbered-list",
        //     icon: (
        //       <svg viewBox="0 0 20 20" style={{ width: "1.5rem" }}>
        //         <path
        //           fill="currentColor"
        //           fillRule="evenodd"
        //           clipRule="evenodd"
        //           d="M3.792 2.094A.5.5 0 0 1 4 2.5V6h1a.5.5 0 1 1 0 1H2a.5.5 0 1 1 0-1h1V3.194l-.842.28a.5.5 0 0 1-.316-.948l1.5-.5a.5.5 0 0 1 .45.068ZM7.75 3.5a.75.75 0 0 0 0 1.5h10a.75.75 0 0 0 0-1.5h-10ZM7 10.75a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5h-10a.75.75 0 0 1-.75-.75Zm0 6.5a.75.75 0 0 1 .75-.75h10a.75.75 0 0 1 0 1.5h-10a.75.75 0 0 1-.75-.75Zm-4.293-3.36a.997.997 0 0 1 .793-.39c.49 0 .75.38.75.75 0 .064-.033.194-.173.409a5.146 5.146 0 0 1-.594.711c-.256.267-.552.548-.87.848l-.088.084a41.6 41.6 0 0 0-.879.845A.5.5 0 0 0 2 18h3a.5.5 0 0 0 0-1H3.242l.058-.055c.316-.298.629-.595.904-.882a6.1 6.1 0 0 0 .711-.859c.18-.277.335-.604.335-.954 0-.787-.582-1.75-1.75-1.75a1.998 1.998 0 0 0-1.81 1.147.5.5 0 1 0 .905.427.996.996 0 0 1 .112-.184Z"
        //         />
        //       </svg>
        //     ),
        //     props: {
        //       disabled: true,
        //       onMouseDown: (e) => {
        //         e.preventDefault();
        //       },
        //     },
        //   },
        // ],
        [
          {
            key: "link",
            icon: (
              <svg viewBox="0 0 64 64" style={{ width: "1.6rem" }}>
                <path
                  d="m27.75,44.73l4.24,4.24-3.51,3.51c-2.34,2.34-5.41,3.51-8.49,3.51-6.63,0-12-5.37-12-12,0-3.07,1.17-6.14,3.51-8.49l10-10c2.34-2.34,5.41-3.51,8.49-3.51s6.14,1.17,8.49,3.51l1.41,1.41-4.24,4.24-1.41-1.41c-1.13-1.13-2.64-1.76-4.24-1.76s-5.11,2.62-6.24,3.76l-8,8c-1.13,1.13-1.76,2.64-1.76,4.24,0,3.31,2.69,6,6,6,1.6,0,3.11-.62,4.24-1.76l3.51-3.51ZM44,8c-3.07,0-6.14,1.17-8.49,3.51l-3.51,3.51,4.24,4.24,3.51-3.51c1.13-1.13,2.64-1.76,4.24-1.76,3.31,0,6,2.69,6,6,0,1.6-.62,3.11-1.76,4.24l-10,10c-1.13,1.13-2.64,1.76-4.24,1.76s-3.11-.62-4.24-1.76l-1.41-1.41-4.24,4.24,1.41,1.41c2.34,2.34,5.41,3.51,8.49,3.51s6.14-1.17,8.49-3.51l10-10c2.34-2.34,3.51-5.41,3.51-8.49,0-6.63-5.37-12-12-12Z"
                  fill="currentColor"
                />
              </svg>
            ),
            props: {
              disabled: disabled || !inlineElementsAllowed,
              onMouseDown: (e) => {
                e.preventDefault();
                linkDialogActions.open();
              },
            },
          },
          {
            key: "image",
            icon: (
              <svg viewBox="0 0 64 64" style={{ width: "1.8rem" }}>
                <path
                  d="m38,27c0-2.76,2.24-5,5-5s5,2.24,5,5-2.24,5-5,5-5-2.24-5-5Zm20-15v40H6V12h52Zm-6,6H12v26l14-14h4l16,16h6v-28Z"
                  fill="currentColor"
                />
              </svg>
            ),
            props: {
              disabled: disabled || !inlineElementsAllowed,
              onMouseDown: (e) => {
                e.preventDefault();
                imageDialogActions.open();
              },
            },
          },
        ],
      ]
        .filter(Boolean)
        .map((sectionActions, i) => {
          const sectionButtons = sectionActions.map((action) =>
            action.type === "select" ? (
              <Select key={action.key} {...action.props} />
            ) : (
              <button
                key={action.key}
                type="button"
                data-button
                {...action.props}
              >
                {action.icon}
              </button>
            )
          );

          if (i === 0) return sectionButtons;

          return (
            <React.Fragment key={i}>
              <div role="separator" aria-orientation="vertical" />
              {sectionButtons}
            </React.Fragment>
          );
        })}
    </div>
  );
};

const LinkDialog = ({
  titleProps,
  dismiss,
  initialLabel,
  initialUrl,
  onSubmit,
}) => (
  <FormDialog
    titleProps={titleProps}
    dismiss={dismiss}
    title={initialUrl == null ? "Insert link" : "Edit link"}
    submitLabel={initialUrl == null ? "Insert link" : "Save changes"}
    submit={onSubmit}
    controls={[
      {
        key: "label",
        initialValue: initialLabel,
        label: "Text",
        type: "text",
      },
      {
        key: "url",
        initialValue: initialUrl,
        label: "URL",
        type: "text",
        validate: urlUtils.validate,
      },
    ].map(({ key, type, initialValue, label, validate }) => ({
      key,
      initialValue,
      type,
      label,
      required: validate != null,
      validate,
      size: "medium",
    }))}
    cancelLabel="Close"
  />
);

const ImageDialog = ({ titleProps, dismiss, initialUrl, onSubmit }) => (
  <FormDialog
    titleProps={titleProps}
    dismiss={dismiss}
    title={initialUrl == null ? "Insert image" : "Edit image"}
    submitLabel={initialUrl == null ? "Insert image" : "Save changes"}
    submit={onSubmit}
    controls={[
      {
        key: "url",
        initialValue: initialUrl,
        label: "URL",
        type: "text",
        required: true,
        validate: urlUtils.validate,
        size: "medium",
      },
    ]}
    cancelLabel="Close"
  />
);

// Wrapper to make rendering `Provider` optional for the consumer
const RichTextEditorWithProvider = React.forwardRef((props, ref) => {
  const context = React.useContext(Context);

  if (context != null) return <RichTextEditor ref={ref} {...props} />;

  return (
    <Provider>
      <RichTextEditor ref={ref} {...props} />
    </Provider>
  );
});

export default RichTextEditorWithProvider;

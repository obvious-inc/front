import { marked } from "marked";
import { string as stringUtils, emoji as emojiUtils } from "../utils.js";

const isProduction = process.env.NODE_ENV === "production";

const fixUrl = (url) => {
  try {
    new URL(url);
    return url;
  } catch (e) {
    // I hate this
    return `http://${url}`;
  }
};

const decodeHtmlEntities = (string) => {
  if (!string.match(/(&.+;)/gi)) return string;
  // textareas are magical
  const textareaEl = document.createElement("textarea");
  textareaEl.innerHTML = string;
  return textareaEl.value;
};

const parseChildren = (token, parse, context_ = {}) => {
  const { list, ...context } = context_;
  const children = list ? token.items : token.tokens;
  return children.reduce((parsedChildren, token) => {
    const parsedChild = parse(token, context);
    if (parsedChild == null) return parsedChildren;
    if (Array.isArray(parsedChild)) return [...parsedChildren, ...parsedChild];
    return [...parsedChildren, parsedChild];
  }, []);
};

const parseToken = (token, context = {}) => {
  switch (token.type) {
    case "paragraph": {
      const children = parseChildren(token, parseToken, context);

      if (children.length === 1 && children[0].type === "text") {
        const maybeEmojiChars = stringUtils.getUserPerceivedCharacters(
          children[0].text.trim()
        );
        if (maybeEmojiChars.every(emojiUtils.isEmoji))
          return maybeEmojiChars.map((c) => ({
            type: "emoji",
            emoji: c,
          }));
      }

      const isImageParagraph = children.every(
        (t) => t.type === "image" || t.text?.trim() === ""
      );

      if (isImageParagraph)
        return {
          type: "image-grid",
          children: children.filter((t) => t.type === "image"),
        };

      return { type: "paragraph", children };
    }

    case "heading":
      return {
        type: `heading-${token.depth}`,
        children: parseChildren(token, parseToken, context),
      };

    case "list":
      return {
        type: token.ordered ? "numbered-list" : "bulleted-list",
        children: parseChildren(token, parseToken, {
          ...context,
          list: true,
        }),
      };

    case "list_item":
      return {
        type: "list-item",
        children: parseChildren(token, parseToken, {
          ...context,
          listMode: "normal", // token.loose ? "normal" : "simple",
        }),
      };

    case "blockquote":
      return {
        type: "quote",
        children: parseChildren(token, parseToken, context),
      };

    case "code":
      return {
        type: "code-block",
        lang: token.lang || null,
        code: token.text,
      };

    case "image": {
      if (context?.displayImages)
        return {
          type: "image",
          url: token.href,
          alt: token.text,
          caption: token.title,
          interactive: false,
        };

      if (context?.link) return { text: context.linkUrl };

      return { type: "link", url: token.href };
    }

    case "hr":
      return { type: "horizontal-divider" };

    case "table": {
      const children = [];

      const parseCell = (cell) =>
        cell.tokens.map((t) => parseToken(t, context));

      if (token.header != null)
        children.push({
          type: "table-head",
          children: [
            {
              type: "table-row",
              children: token.header.map((cell) => ({
                type: "table-cell",
                children: parseCell(cell),
              })),
            },
          ],
        });

      children.push({
        type: "table-body",
        children: token.rows.map((row) => ({
          type: "table-row",
          children: row.map((cell) => ({
            type: "table-cell",
            children: parseCell(cell),
          })),
        })),
      });

      return {
        type: "table",
        children,
      };
    }

    case "link": {
      const isImageUrl = ["jpg", "png", "gif"].some((ext) =>
        token.href.endsWith(`.${ext}`)
      );

      const hasLabel = token.text !== token.href;

      const url = fixUrl(token.href);

      if (isImageUrl && !hasLabel && context?.displayImages)
        return { type: "image", url, interactive: false };

      const children = parseChildren(token, parseToken, {
        ...context,
        link: true,
        linkUrl: url,
      });

      if (children.some((n) => n.type === "image")) {
        const imageEl = children.find((n) => n.type === "image");
        // return { type: "image-grid", children: [{ ...imageEl, caption: url }] };
        return { ...imageEl, caption: url };
      }

      return {
        type: "link",
        url,
        children,
      };
    }

    case "codespan":
      return { type: "code", code: token.text };

    case "del": {
      // Don’t strikethrough single tildes
      if (token.raw.startsWith("~~"))
        return parseChildren(token, parseToken, {
          ...context,
          strikethrough: true,
        });

      return [
        { type: "text", text: "~" },
        ...parseChildren(token, parseToken, context),
        { type: "text", text: "~" },
      ];
    }

    case "strong":
      return parseChildren(token, parseToken, { ...context, bold: true });

    case "em":
      return parseChildren(token, parseToken, { ...context, italic: true });

    case "br":
      return { type: "text", text: "\n" };

    case "escape":
      return { type: "text", text: token.text };

    case "text": {
      if (token.tokens != null) {
        const { listMode, ...context_ } = context;
        const children = parseChildren(token, parseToken, context_);
        if (listMode == null || listMode === "simple") return children;
        return { type: "paragraph", children };
      }

      const el = {
        type: "text",
        text: decodeHtmlEntities(token.text),
      };

      if (context?.bold) el.bold = true;
      if (context?.italic) el.italic = true;
      if (context?.strikethrough) el.strikethrough = true;
      return el;
    }

    case "space":
      return null;

    case "html":
      return { type: "text", text: token.text };

    default:
      if (isProduction) return null;
      throw new Error(`Unknown token "${token.type}"`);
  }
};

export const toMessageBlocks = (text, { displayImages = true } = {}) => {
  const tokens = marked.lexer(text);
  return tokens
    .map((t, index) => parseToken(t, { displayImages, index }))
    .filter(Boolean);
};

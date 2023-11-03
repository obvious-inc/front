import { marked } from "marked";
import { string as stringUtils, emoji as emojiUtils } from "../utils.js";

const isProduction = process.env.NODE_ENV === "production";

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
      const isImageParagraph = token.tokens.every(
        (t) => t.type === "image" || t.text.trim() === ""
      );

      if (isImageParagraph) {
        const imageTokens = token.tokens.filter((t) => t.type === "image");
        return {
          type: "image-grid",
          children: imageTokens.map((t) => ({
            type: "image",
            url: t.href,
            interactive: false,
          })),
        };
      }

      return {
        type: "paragraph",
        children: parseChildren(token, parseToken, context),
      };
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
          interactive: false,
        };

      if (context?.link) return { text: context.linkUrl };

      return { type: "link", url: token.href };
    }

    case "hr":
      return { type: "horizontal-divider" };

    case "table":
      return {
        type: "table",
        header: token.header.map((t) => t.text),
        rows: token.rows.map((r) => r.map((c) => c.text)),
      };

    case "link": {
      const isImageUrl = ["jpg", "png", "gif"].some((ext) =>
        token.href.endsWith(`.${ext}`)
      );

      const hasLabel = token.text !== token.href;

      if (isImageUrl && !hasLabel && context?.displayImages)
        return { type: "image", url: token.href, interactive: false };

      return {
        type: "link",
        url: token.href,
        children: parseChildren(token, parseToken, {
          ...context,
          link: true,
          linkUrl: token.href,
        }),
      };
    }

    case "codespan":
      return { type: "code", code: token.text };

    case "del":
      return parseChildren(token, parseToken, {
        ...context,
        strikethrough: true,
      });

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

      const text = decodeHtmlEntities(token.text);

      const maybeEmojiChars =
        text.length <= 10 &&
        stringUtils.getUserPerceivedCharacters(text.trim());

      if (
        Array.isArray(maybeEmojiChars) &&
        maybeEmojiChars.every(emojiUtils.isEmoji)
      )
        return maybeEmojiChars.map((c) => ({
          type: "emoji",
          emoji: c,
        }));

      const el = { type: "text", text };
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
  return tokens.map((t) => parseToken(t, { displayImages })).filter(Boolean);
};

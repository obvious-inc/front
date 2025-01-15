import React from "react";
import { useCachedState } from "@shades/common/app";

const useCachedPost = (cacheId, { searchParams }) => {
  const [post, setPost, { isInitialized }] = useCachedState(cacheId, {
    comment: "",
    support: null,
    replies: {},
    reposts: [],
  });

  const urlInitRef = React.useRef(true);

  const setComment = (comment) => setPost((s) => ({ ...s, comment }));
  const setSupport = (support) => setPost((s) => ({ ...s, support }));

  const setReply = React.useCallback(
    (feedItemId, reply) => {
      setPost((s) => ({
        ...s,
        replies: {
          ...(s?.replies ?? {}),
          [feedItemId]: reply,
        },
      }));
    },
    [setPost],
  );

  const addReply = React.useCallback(
    (feedItemId) => {
      if (Object.keys(post?.replies ?? {}).includes(feedItemId)) return;
      setReply(feedItemId, "");
    },
    [post, setReply],
  );

  const deleteReply = (feedItemId) => {
    setPost((s) => {
      const replies = { ...(s?.replies ?? {}) };
      delete replies[feedItemId];
      return { ...s, replies };
    });
  };

  const addRepost = React.useCallback(
    (feedItemId, { support }) => {
      setPost((s) => {
        const currentReposts = s?.reposts ?? [];
        if (currentReposts.includes(feedItemId)) return s;
        return {
          ...s,
          reposts: [...currentReposts, feedItemId],
          support: support ?? s?.support,
        };
      });
    },
    [setPost],
  );

  const deleteRepost = (feedItemId) => {
    setPost((s) => ({
      ...s,
      reposts: (s?.reposts ?? []).filter((id) => id !== feedItemId),
    }));
  };

  const clearPost = () => setPost(null);

  // add reply/repost from search params only once
  React.useEffect(() => {
    if (!isInitialized) return;
    if (!urlInitRef.current) return;

    const replyTarget = searchParams.get("reply-target");
    const repostTarget = searchParams.get("repost-target");

    if (replyTarget) addReply(replyTarget);
    if (repostTarget) addRepost(repostTarget);

    urlInitRef.current = false;
  }, [searchParams, addReply, addRepost, isInitialized]);

  const { comment = "", support, replies, reposts } = post ?? {};

  return [
    { comment, support, replies, reposts },
    {
      setComment,
      setSupport,
      setReply,
      addReply,
      deleteReply,
      addRepost,
      deleteRepost,
      clearPost,
    },
  ];
};

export default useCachedPost;

"use client";

import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import Link from "@shades/ui-web/link";
import { Cross as CrossIcon } from "@shades/ui-web/icons";

const AppUpdateBanner = () => {
  const [isDismissed, setDismissed] = React.useState(false);
  const [hasUpdate, setHasUpdate] = React.useState(false);

  useFetch(
    () =>
      fetch("/", { method: "HEAD" }).then((res) => {
        const buildId = process.env.BUILD_ID;
        const newBuildId = res.headers.get("x-camp-build-id");
        if (buildId == null || buildId === newBuildId) return;
        console.log(
          `New build available: "${newBuildId}"\nCurrently running: "${buildId}"`,
        );
        setHasUpdate(true);
      }),
    [],
  );

  const showBanner = hasUpdate && !isDismissed;

  if (!showBanner) return null;

  return (
    <div
      css={(t) =>
        css({
          position: "fixed",
          zIndex: 1,
          width: "100%",
          background: t.colors.backgroundPrimary,
        })
      }
    >
      <div
        css={(t) =>
          css({
            color: t.colors.textAccent,
            display: "flex",
            alignItems: "center",
            padding: "0.8rem 1.2rem",
            background: t.colors.primaryTransparent,
            fontSize: t.text.sizes.small,
            minHeight: "3.8rem",
            transition: "0.25s all ease-out",
          })
        }
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          New version of Camp available.{" "}
          <Link underline prefetch component={NextLink} href="/">
            Click here to update
          </Link>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
          }}
          style={{ padding: "0.8rem", margin: "-0.8rem", cursor: "pointer" }}
        >
          <CrossIcon
            style={{ width: "1.5rem", height: "auto", margin: "auto" }}
          />
        </button>
      </div>
    </div>
  );
};

export default AppUpdateBanner;

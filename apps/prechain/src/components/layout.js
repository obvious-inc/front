import va from "@vercel/analytics";
import React from "react";
import { css } from "@emotion/react";
import { useLocation, Link as RouterLink } from "react-router-dom";
import { useAccountDisplayName } from "@shades/common/app";
import Button from "@shades/ui-web/button";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import AccountAvatar from "./account-avatar.js";
import LogoSymbol from "./logo-symbol.js";

const Layout = ({
  scrollContainerRef,
  navigationStack = [],
  actions = [],
  scrollView = true,
  children,
}) => (
  <div
    css={(t) =>
      css({
        position: "relative",
        zIndex: 0,
        flex: 1,
        minWidth: "min(30.6rem, 100vw)",
        background: t.colors.backgroundPrimary,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      })
    }
  >
    <NavBar navigationStack={navigationStack} actions={actions} />
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      {scrollView ? (
        <div
          ref={scrollContainerRef}
          css={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            minHeight: 0,
            flex: 1,
            overflowAnchor: "none",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const NavBar = ({ navigationStack, actions }) => {
  const location = useLocation();

  const { open: openAccountDialog } = useDialog("account");

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
    switchToMainnet: switchWalletToMainnet,
    isUnsupportedChain,
    isLoading: isLoadingWallet,
  } = useWallet();
  const { displayName: connectedAccountDisplayName } = useAccountDisplayName(
    connectedWalletAccountAddress
  );

  return (
    <div
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          whiteSpace: "nowrap",
          minHeight: t.navBarHeight, // "4.7rem",
          "@media (max-width: 600px)": {
            '[data-desktop-only="true"]': {
              display: "none",
            },
          },
        })
      }
    >
      <div
        css={css({
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: "0.2rem",
          overflow: "hidden",
          padding: "1rem 1.6rem",
          "@media (min-width: 600px)": {
            padding: "1rem",
          },
        })}
      >
        {[
          {
            to: "/",
            label: (
              <>
                <LogoSymbol
                  css={css({
                    display: "inline-block",
                    width: "2rem",
                    height: "auto",
                    verticalAlign: "sub",
                    transform: "translateY(0.15rem)",
                  })}
                />
                {location.pathname !== "/" && (
                  <span
                    css={css({
                      marginLeft: "0.6rem",
                      "@media(max-width: 440px)": { display: "none" },
                    })}
                  >
                    Camp
                  </span>
                )}
              </>
            ),
          },
          ...navigationStack,
        ].map((item, index) => (
          <React.Fragment key={item.to}>
            {index > 0 && (
              <span
                data-index={index}
                data-desktop-only={item.desktopOnly}
                css={(t) =>
                  css({
                    color: t.colors.textMuted,
                    fontSize: t.text.sizes.base,
                    "@media(max-width: 440px)": {
                      '&[data-index="1"]': { display: "none" },
                    },
                  })
                }
              >
                {"/"}
              </span>
            )}
            <RouterLink
              to={item.to}
              data-disabled={location.pathname === item.to}
              data-desktop-only={item.desktopOnly}
              css={(t) =>
                css({
                  fontSize: t.fontSizes.base,
                  color: t.colors.textNormal,
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.2rem",
                  textDecoration: "none",
                  '&[data-disabled="true"]': { pointerEvents: "none" },
                  "@media(hover: hover)": {
                    cursor: "pointer",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  },
                })
              }
            >
              {item.label}
            </RouterLink>
          </React.Fragment>
        ))}
      </div>
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.base,
            padding: "0 1.6rem",
            ul: {
              display: "grid",
              gridAutoFlow: "column",
              gridGap: "0.5rem",
              alignItems: "center",
            },
            li: { listStyle: "none" },
            "@media (min-width: 600px)": {
              padding: "0 1rem",
            },
          })
        }
      >
        <ul>
          {[
            ...actions,
            actions.length !== 0 && { type: "separator" },
            connectedWalletAccountAddress == null
              ? {
                  onSelect: () => {
                    va.track("Connect Wallet", { location: "navbar" });
                    requestWalletAccess();
                  },
                  buttonProps: {
                    variant: "default",
                    isLoading: requestWalletAccess == null || isLoadingWallet,
                    disabled: requestWalletAccess == null || isLoadingWallet,
                  },
                  label: "Connect Wallet",
                }
              : isUnsupportedChain
              ? {
                  onSelect: () => {
                    switchWalletToMainnet().catch(() => {
                      alert("Ops, something went wrong!");
                    });
                  },
                  buttonProps: {
                    variant: "default",
                    isLoading: isLoadingWallet,
                    disabled: switchWalletToMainnet == null || isLoadingWallet,
                  },
                  label: "Switch to Mainnet",
                }
              : {
                  onSelect: () => {
                    openAccountDialog();
                  },
                  // buttonProps: {
                  //   component: "a",
                  //   href: `https://etherscan.io/address/${connectedWalletAccountAddress}`,
                  //   target: "_blank",
                  //   rel: "noreferrer",
                  // },

                  label: (
                    <div
                      css={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.8rem",
                      })}
                    >
                      <div>{connectedAccountDisplayName}</div>
                      <AccountAvatar
                        address={connectedWalletAccountAddress}
                        size="2rem"
                      />
                    </div>
                  ),
                },
          ]
            .filter(Boolean)
            .map((a, i) =>
              a.type === "separator" ? (
                <li
                  key={i}
                  role="separator"
                  aria-orientation="vertical"
                  css={(t) =>
                    css({
                      width: "0.1rem",
                      background: t.colors.borderLight,
                      height: "1.6rem",
                    })
                  }
                />
              ) : (
                <li key={a.label} data-desktop-only={a.desktopOnly}>
                  <Button
                    variant={a.buttonVariant ?? "transparent"}
                    size="small"
                    onClick={a.onSelect}
                    {...a.buttonProps}
                  >
                    {a.label}
                  </Button>
                </li>
              )
            )}
        </ul>
      </div>
    </div>
  );
};

export const MainContentContainer = ({
  sidebar = null,
  narrow = false,
  children,
  ...props
}) => (
  <div
    css={css({
      "@media (min-width: 600px)": {
        margin: "0 auto",
        maxWidth: "100%",
        width: "var(--width)",
        padding: "0 4rem",
      },
      "@media (min-width: 952px)": {
        padding: "0 6rem",
      },
    })}
    style={{
      "--width": narrow ? "72rem" : "128rem",
    }}
    {...props}
  >
    {sidebar == null ? (
      children
    ) : (
      <div
        css={(t) =>
          css({
            "@media (min-width: 952px)": {
              display: "grid",
              gridTemplateColumns: `minmax(0, 1fr) ${t.sidebarWidth} `,
              gridGap: "8rem",
              "[data-sidebar-content]": {
                position: "sticky",
                top: 0,
                maxHeight: `calc(100vh - ${t.navBarHeight})`,
                overflow: "auto",
                // Prevents the scrollbar from overlapping the content
                margin: "0 -2rem",
                padding: "0 2rem",
              },
            },
          })
        }
      >
        <div>{children}</div>
        <div>
          <div data-sidebar-content>{sidebar}</div>
        </div>
      </div>
    )}
  </div>
);

export default Layout;

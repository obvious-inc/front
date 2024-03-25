import React from "react";
import {
  MagnificationGlass as MagnificationGlassIcon,
  Triangle as TriangleIcon,
  Pen as PenIcon,
  Bell as BellIcon,
  Home as HomeIcon,
  RSS as RSSIcon,
  Farcord as FarcordIcon,
} from "@shades/ui-web/icons";
import { css, useTheme } from "@emotion/react";
import {
  NavLink,
  Outlet,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useFarcasterChannels } from "../hooks/farcord";
import {
  useState as useSidebarState,
  useToggle as useSidebarToggle,
  Layout as SidebarLayout,
} from "@shades/ui-web/sidebar-layout";
import { ErrorBoundary } from "@shades/common/react";
import Avatar from "@shades/ui-web/avatar";
import ProfileDropdownTrigger from "./farcaster-profile";
import Button from "@shades/ui-web/button";
import Dialog from "@shades/ui-web/dialog";
import AuthDialog from "./auth-dialog";
import useFarcasterAccount from "./farcaster-account";
import {
  useChannelUnreadCount,
  useFollowedChannels,
  useUnreadStatesFetch,
} from "../hooks/channel";
import { getChannelLink, getChannelName } from "../utils/channel";
import CreateChannelDialog from "./create-channel-dialog";
import { useNotificationsBadge } from "../hooks/notifications";
import NotificationBadge from "./notification-badge";
import { array as arrayUtils, reloadPageOnce } from "@shades/common/utils";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import useSigner from "./signer";
import MetaTags from "./meta-tags";

const { sort } = arrayUtils;

const DEFAULT_TRUNCATED_COUNT = 10;

const ListItem = React.forwardRef(
  (
    {
      component: Component = "button",
      expandable,
      expanded,
      size,
      compact = true,
      onToggleExpanded,
      indendationLevel = 0,
      icon,
      title,
      subtitle,
      disabled,
      ...props
    },
    ref,
  ) => {
    const iconSize = size === "large" ? "3rem" : "2rem";
    return (
      <div className="list-item">
        <Component
          ref={ref}
          disabled={Component === "button" ? disabled : undefined}
          style={{
            "--indentation-level": indendationLevel,
            pointerEvents:
              Component !== "button" && disabled ? "none" : undefined,
            color: disabled ? `var(--disabled-color)` : undefined,
            height: size === "large" ? "4.4rem" : "var(--item-height)",
          }}
          {...props}
        >
          {expandable && (
            <div
              css={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2.2rem",
                height: "2.2rem",
              })}
              style={{ marginRight: icon == null ? "0.4rem" : 0 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  onToggleExpanded();
                }}
                css={(t) =>
                  css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    color: t.colors.textMuted,
                    borderRadius: "0.3rem",
                    transition: "background 20ms ease-in",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  })
                }
              >
                <TriangleIcon
                  style={{
                    transition: "transform 200ms ease-out",
                    transform: `rotate(${expanded ? "180deg" : "90deg"})`,
                    width: "0.963rem",
                  }}
                />
              </div>
            </div>
          )}
          {icon != null && (
            <div
              className="icon-container"
              style={{
                marginRight:
                  size === "large"
                    ? "0.88888888rem"
                    : compact
                      ? "0.4rem"
                      : "0.8rem",
                width: `calc(${iconSize} + 0.2rem)`,
              }}
            >
              <div
                style={{
                  color: disabled ? "var(--disabled-color)" : undefined,
                  width: iconSize,
                  height: iconSize,
                }}
              >
                {icon}
              </div>
            </div>
          )}
          <div className="title-container">
            {title}
            {subtitle != null && (
              <div className="subtitle-container">{subtitle}</div>
            )}
          </div>
        </Component>
      </div>
    );
  },
);

export const ChannelItem = ({ channel, expandable }) => {
  const theme = useTheme();
  const link = getChannelLink(channel);
  const unreadCount = useChannelUnreadCount(channel?.id);

  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  const channelTitle = getChannelName(channel);

  return (
    <ListItem
      expandable={expandable}
      component={NavLink}
      to={{ pathname: link, search: location.search }}
      onClick={closeMenu}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gridGap: "0.4rem",
            color: unreadCount > 0 ? theme.colors.textNormal : undefined,
            fontWeight:
              unreadCount > 0 && theme.light
                ? theme.text.weights.emphasis
                : undefined,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              alignItems: "center",
            }}
          >
            <div css={css({ overflow: "hidden", textOverflow: "ellipsis" })}>
              {channelTitle}
            </div>
            {unreadCount > 0 && <NotificationBadge count={unreadCount} />}
          </div>
        </div>
      }
      icon={
        <span>
          <Avatar url={channel.imageUrl} />
        </span>
      }
      size="normal"
    />
  );
};

export const NotificationsItem = ({ fid, expandable, ...props }) => {
  const theme = useTheme();

  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const notificationsBadge = useNotificationsBadge(fid);

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  return (
    <ListItem
      expandable={expandable}
      compact={false}
      component={NavLink}
      to={{ pathname: "/notifications", search: location.search }}
      onClick={closeMenu}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            gridGap: "0.4rem",
            color:
              notificationsBadge?.count > 0
                ? theme.colors.textNormal
                : undefined,
            fontWeight:
              notificationsBadge?.count > 0 && theme.light
                ? theme.text.weights.emphasis
                : undefined,
          }}
        >
          <p>Notifications</p>
          {notificationsBadge.count > 0 && (
            <NotificationBadge
              count={notificationsBadge.count}
              hasImportant={notificationsBadge.hasImportant}
            />
          )}
        </div>
      }
      icon={<BellIcon style={{ width: "1.9rem", height: "auto" }} />}
      {...props}
    />
  );
};

export const FeedItem = () => {
  const link = `/feed`;
  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  return (
    <ListItem
      component={NavLink}
      compact={false}
      to={{ pathname: link, search: location.search }}
      onClick={closeMenu}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          Your Feed
        </div>
      }
      icon={<HomeIcon style={{ width: "1.9rem", height: "auto" }} />}
    />
  );
};

export const RecentItem = () => {
  const link = `/recent`;
  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  return (
    <ListItem
      component={NavLink}
      compact={false}
      to={{ pathname: link, search: location.search }}
      onClick={closeMenu}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          All Casts
        </div>
      }
      icon={<RSSIcon style={{ width: "1.9rem", height: "auto" }} />}
    />
  );
};

export const FarcordItem = () => {
  const { isFloating: isFloatingMenuEnabled } = useSidebarState();
  const toggleMenu = useSidebarToggle();

  const closeMenu = () => {
    if (isFloatingMenuEnabled) toggleMenu();
  };

  return (
    <ListItem
      component={NavLink}
      compact={false}
      to={{
        pathname: "/channels/https%3A%2F%2Ffarcord.com",
        search: location.search,
      }}
      onClick={closeMenu}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          Farcord
        </div>
      }
      icon={<FarcordIcon style={{ width: "1.9rem", height: "auto" }} />}
    />
  );
};

const CollapsibleSection = ({
  title,
  expanded,
  truncatedCount = 0,
  onToggleExpanded,
  onToggleTruncated,
  children,
}) => (
  <section style={{ marginBottom: expanded ? "1.8rem" : 0 }}>
    <div
      css={(t) =>
        css({
          margin: "0.6rem 0 0.2rem",
          padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
          minHeight: "2.4rem",
          display: "grid",
          alignItems: "center",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gridGap: "1rem",
        })
      }
    >
      <button
        onClick={onToggleExpanded}
        css={(theme) =>
          css({
            lineHeight: 1,
            padding: "0.2rem 0.4rem",
            marginLeft: "-0.4rem",
            color: "rgb(255 255 255 / 28.2%)",
            transition: "background 20ms ease-in, color 100ms ease-out",
            borderRadius: "0.3rem",
            cursor: "pointer",
            justifySelf: "flex-start",
            outline: "none",
            ":hover": {
              color: "rgb(255 255 255 / 56.5%)",
              background: theme.colors.backgroundModifierHover,
            },
            ":focus-visible": {
              color: "rgb(255 255 255 / 56.5%)",
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
          })
        }
      >
        <SmallText>{title}</SmallText>
      </button>
    </div>

    {expanded && (
      <>
        {children}
        {truncatedCount > 0 && (
          <ListItem
            component="button"
            onClick={onToggleTruncated}
            title={
              <SmallText css={css({ padding: "0 0.4rem" })}>
                {truncatedCount} more...
              </SmallText>
            }
          />
        )}
      </>
    )}
  </section>
);

const SmallText = ({ component: Component = "div", ...props }) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.text.sizes.small,
        fontWeight: t.text.weights.emphasis,
        lineHeight: 1,
        color: t.colors.textMutedAlpha,
      })
    }
    {...props}
  />
);

export const MainLayout = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();

  const { fid, logout } = useFarcasterAccount();
  const { broadcasted } = useSigner();

  const storedFollowedChannels = useFollowedChannels(fid);
  const farcasterChannels = useFarcasterChannels();
  useUnreadStatesFetch(fid);

  const [remainingChannels, setRemainingChannels] = React.useState([]);
  const [allChannelsExpanded, setAllChannelsExpanded] = React.useState(true);
  const [visibleAllChannels, setVisibleAllChannels] = React.useState([]);
  const [followedChannels, setFollowedChannels] = React.useState([]);

  const isAuthDialogOpen = searchParams.get("auth-dialog") != null;
  const isCreateChannelDialogOpen = searchParams.get("create-channel") != null;

  const closeAuthDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("auth-dialog");
      newParams.delete("provider");
      return newParams;
    });
  }, [setSearchParams]);

  const closeCreateChannelDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("create-channel");
      return newParams;
    });
  }, [setSearchParams]);

  React.useEffect(() => {
    const followedChannelsIds = storedFollowedChannels?.map((c) => c.id);
    const remainingChannels = farcasterChannels.filter(
      (channel) => !followedChannelsIds?.includes(channel.id),
    );

    const fChannels = storedFollowedChannels?.filter(
      (c) => c.id != "https://farcord.com",
    );

    const sortedChannels = sort((c1, c2) => {
      if (c1.name.startsWith("http") && c2.name.startsWith("http")) return 0;
      if (c1.name.startsWith("http")) return 1;
      if (c2.name.startsWith("http")) return -1;
      return c1.name.toLowerCase().localeCompare(c2.name.toLowerCase());
    }, fChannels ?? []);

    setFollowedChannels(sortedChannels);
    setRemainingChannels(remainingChannels);
    setVisibleAllChannels(remainingChannels.slice(0, DEFAULT_TRUNCATED_COUNT));
  }, [farcasterChannels, storedFollowedChannels]);

  const isReadOnly = Boolean(fid) && !broadcasted;
  const isAuthenticated = Boolean(fid);

  return (
    <>
      <MetaTags />
      <SidebarLayout
        header={({ isHoveringSidebar }) =>
          !fid ? (
            <div
              style={{
                justifySelf: "center",
                width: "100%",
                padding: "0 1rem",
              }}
            >
              <Button
                style={{ width: "100%" }}
                onClick={() => {
                  navigate("/login");
                }}
              >
                Sign in
              </Button>
            </div>
          ) : (
            <DropdownMenu.Root placement="bottom">
              <DropdownMenu.Trigger>
                <ProfileDropdownTrigger
                  fid={fid}
                  subtitle={!broadcasted ? "read-only" : null}
                  isHoveringSidebar={isHoveringSidebar}
                />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content
                css={(theme) =>
                  css({
                    "--menu-width": `var(--menu-width-override, ${theme.sidebarWidth})`,
                    width: `calc(var(--menu-width) - 2rem)`,
                  })
                }
                // style={{ "--menu-width-override": menuWidthOverride }}
                items={[
                  isReadOnly && {
                    id: "verify-account",
                    children: [
                      {
                        id: "verify-account",
                        label: "Connect Farcord",
                        primary: true,
                      },
                    ],
                  },
                  {
                    id: "main",
                    children: [
                      // { id: "settings", label: "Settings" },
                      { id: "edit-profile", label: "Edit profile" },
                      { id: "edit-apps", label: "Connected apps" },
                      // { id: "share-profile", label: "Share profile" },
                      // {
                      //   id: "copy-account-address",
                      //   label: "Copy account address",
                      // },
                    ],
                  },
                  // {
                  //   id: "switch",
                  //   children: [
                  //     {
                  //       id: "switch-account",
                  //       label: "Switch to another account",
                  //     },
                  //   ],
                  // },
                  isAuthenticated && {
                    id: "log-out",
                    children: [{ id: "log-out", label: "Log out" }],
                  },
                ].filter(Boolean)}
                onAction={(key) => {
                  switch (key) {
                    case "verify-account":
                      navigate("/profile/apps/new");
                      break;

                    // case "settings":
                    //   openSettingsDialog();
                    //   break;

                    case "edit-profile":
                      navigate("/profile");
                      break;

                    case "edit-apps":
                      navigate("/profile/apps");
                      break;

                    // case "share-profile":
                    //   openProfileLinkDialog();
                    //   break;

                    case "switch-account":
                      alert("Just switch account from your wallet!");
                      break;

                    case "log-out":
                      logout();
                      break;
                  }
                }}
              >
                {(item) => (
                  <DropdownMenu.Section items={item.children}>
                    {(item) => (
                      <DropdownMenu.Item primary={item.primary}>
                        {item.label}
                      </DropdownMenu.Item>
                    )}
                  </DropdownMenu.Section>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )
        }
        sidebarContent={
          <div
            css={(t) =>
              css({
                "--item-height": t.mainMenu.itemHeight,
                "--disabled-color": t.mainMenu.itemTextColorDisabled,
                ".list-item": {
                  padding: `0 ${t.mainMenu.containerHorizontalPadding}`,
                  "&:not(:last-of-type)": {
                    marginBottom: t.mainMenu.itemDistance,
                  },
                  "& > *": {
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    border: 0,
                    fontSize: t.fontSizes.default,
                    fontWeight: t.mainMenu.itemTextWeight,
                    textAlign: "left",
                    background: "transparent",
                    borderRadius: t.mainMenu.itemBorderRadius,
                    outline: "none",
                    color: t.mainMenu.itemTextColor,
                    padding: `0.2rem ${t.mainMenu.itemHorizontalPadding}`,
                    paddingLeft: `calc(${t.mainMenu.itemHorizontalPadding} + var(--indentation-level) * 2.2rem)`,
                    textDecoration: "none",
                    lineHeight: 1.3,
                    margin: "0.1rem 0",
                    "&.active": {
                      color: t.colors.textNormal,
                      background: t.colors.backgroundModifierHover,
                    },
                    ".icon-container": {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "1.8rem",
                    },
                    ".icon-container > *": {
                      color: t.colors.textMuted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    ".title-container": {
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    ".subtitle-container": {
                      color: t.colors.textMuted,
                      fontSize: t.text.sizes.small,
                      fontWeight: t.text.weights.normal,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    "@media (hover: hover)": {
                      ":not(:disabled)": {
                        cursor: "pointer",
                      },
                      ":not(:disabled,&.active):hover": {
                        background: t.colors.backgroundModifierHover,
                      },
                    },
                    ":focus-visible": {
                      boxShadow: t.shadows.focus,
                    },
                  },
                },
              })
            }
          >
            <div
              style={{
                height: "1rem",
              }}
            />

            <ListItem
              compact={false}
              icon={<PenIcon style={{ width: "1.9rem", height: "auto" }} />}
              title="Create Channel"
              onClick={() => {
                setSearchParams((params) => {
                  const newParams = new URLSearchParams(params);
                  newParams.set("create-channel", 1);
                  return newParams;
                });
              }}
            />

            <NotificationsItem fid={fid} disabled={!fid} />

            <ListItem
              compact={false}
              disabled={true}
              icon={<MagnificationGlassIcon style={{ width: "1.4rem" }} />}
              title="Search"
            />

            <div
              role="separator"
              css={(t) =>
                css({
                  margin: "1rem",
                  borderTop: "0.1rem solid",
                  borderColor: t.colors.borderLighter,
                })
              }
            />

            {fid && <FeedItem />}
            <RecentItem />
            <FarcordItem />

            <div
              role="separator"
              css={(t) =>
                css({
                  margin: "1rem",
                  borderTop: "0.1rem solid",
                  borderColor: t.colors.borderLighter,
                })
              }
            />

            {followedChannels?.length > 0 && (
              <>
                <CollapsibleSection
                  key="star"
                  title="Followed Channels"
                  expanded={true}
                >
                  {followedChannels?.map((c) => (
                    <ChannelItem key={`star-${c.id}`} channel={c} />
                  ))}
                </CollapsibleSection>
                <div style={{ height: "1rem" }} />
              </>
            )}

            <CollapsibleSection
              key="fc"
              title="All Channels"
              expanded={allChannelsExpanded}
              truncatedCount={
                remainingChannels.length - visibleAllChannels.length
              }
              onToggleExpanded={() =>
                setAllChannelsExpanded(!allChannelsExpanded)
              }
              onToggleTruncated={() => setVisibleAllChannels(remainingChannels)}
            >
              {visibleAllChannels.map((c) => (
                <ChannelItem key={`fc-${c.id}`} channel={c} />
              ))}
            </CollapsibleSection>
          </div>
        }
      >
        {children}

        {isAuthDialogOpen && (
          <Dialog
            isOpen={isAuthDialogOpen}
            onRequestClose={closeAuthDialog}
            width="76rem"
          >
            {({ titleProps }) => (
              <ErrorBoundary
                onError={() => {
                  reloadPageOnce();
                }}
              >
                <React.Suspense fallback={null}>
                  <AuthDialog
                    titleProps={titleProps}
                    dismiss={closeAuthDialog}
                  />
                </React.Suspense>
              </ErrorBoundary>
            )}
          </Dialog>
        )}

        {isCreateChannelDialogOpen && (
          <Dialog
            isOpen={isCreateChannelDialogOpen}
            onRequestClose={closeCreateChannelDialog}
            width="76rem"
          >
            {({ titleProps }) => (
              <ErrorBoundary
                fallback={() => {
                  // window.location.reload();
                }}
              >
                <React.Suspense fallback={null}>
                  <CreateChannelDialog
                    titleProps={titleProps}
                    dismiss={closeCreateChannelDialog}
                  />
                </React.Suspense>
              </ErrorBoundary>
            )}
          </Dialog>
        )}

        <ErrorBoundary fallback={() => window.location.reload()}>
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </ErrorBoundary>
      </SidebarLayout>
    </>
  );
};

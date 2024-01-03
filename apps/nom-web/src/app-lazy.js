import { isAddress as isEthereumAccountAddress } from "viem";
import { normalize as normalizeEnsName } from "viem/ens";
import { mainnet } from "viem/chains";
import {
  WagmiConfig,
  createConfig as createWagmiConfig,
  configureChains as configureWagmiChains,
  usePublicClient as usePublicEthereumClient,
} from "wagmi";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
  useLocation,
  matchPath,
} from "react-router-dom";
import { ThemeProvider, Global, css } from "@emotion/react";
import {
  EmojiProvider,
  useAuth,
  useSelectors,
  useActions,
  useAfterActionListener,
  useCacheStore,
} from "@shades/common/app";
import { useMatchMedia } from "@shades/common/react";
import { useWalletLogin, WalletLoginProvider } from "@shades/common/wallet";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import defaultTheme, {
  dark as darkTheme,
  light as lightTheme,
} from "@shades/ui-web/theme";
import { Provider as SidebarProvider } from "@shades/ui-web/sidebar-layout";
import * as Tooltip from "@shades/ui-web/tooltip";
import { IFrameEthereumProvider } from "@newshades/iframe-provider";
import { Provider as DialogsProvider } from "./hooks/dialogs.js";
import { send as sendNotification } from "./utils/notifications.js";
import useCommandCenter, {
  Provider as CommandCenterProvider,
} from "./hooks/command-center.js";
import useWalletEvent from "./hooks/wallet-event.js";
import useSetting from "./hooks/setting.js";
import GlobalDialogs from "./components/global-dialogs.js";
import LoginScreen from "./components/login-screen.js";
import Layout from "./components/layouts.js";
import TitleBar from "./components/title-bar.js";
import { nounsTv as nounsTvTheme } from "./themes.js";

const AccountProfileScreen = React.lazy(() =>
  import("./components/account-profile-screen")
);
const ChannelScreen = React.lazy(() => import("./components/channel-route.js"));
const ChannelBase = React.lazy(() => import("./components/channel.js"));
const CommandCenterLazy = React.lazy(() =>
  import("./components/command-center.js")
);
const AuthScreen = React.lazy(() => import("./components/auth.js"));
const NewMessageScreen = React.lazy(() =>
  import("./components/new-message-screen.js")
);
const ChannelsScreen = React.lazy(() =>
  import("./components/channels-screen.js")
);

const { truncateAddress } = ethereumUtils;

const isNative = window.Native != null;
const isReactNativeWebView = window.ReactNativeWebView != null;

const isIFrame = window.parent && window.self && window.parent !== window.self;
if (isIFrame) window.ethereum = new IFrameEthereumProvider();

const { chains, publicClient } = configureWagmiChains(
  [mainnet],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()],
  {
    batch: {
      multicall: {
        wait: 250,
        batchSize: 1024 * 8, // 8kb seems to be the max size for cloudflare
      },
    },
  }
);

const wagmiConfig = createWagmiConfig({
  autoConnect: true,
  publicClient,
  connectors: [
    new InjectedConnector({
      chains,
      options: { isIFrame },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.WALLET_CONNECT_PROJECT_ID,
      },
    }),
  ],
});

const useSystemNotifications = () => {
  const navigate = useNavigate();
  const selectors = useSelectors();

  const hasGrantedPushNotificationPermission =
    window.Notification?.permission === "granted";

  useAfterActionListener(
    !hasGrantedPushNotificationPermission
      ? null
      : (action) => {
          switch (action.type) {
            case "server-event:message-created": {
              const me = selectors.selectMe();
              const message = selectors.selectMessage(action.data.message.id);

              // Temporary test
              if (message == null) break;

              if (message.authorUserId === me.id) break;

              const hasUnread = selectors.selectChannelHasUnread(
                message.channelId
              );

              if (!hasUnread) break;

              const channel = selectors.selectChannel(message.channelId);

              import("@shades/common/nouns").then((module) => {
                sendNotification({
                  title: `Message from ${
                    message.author?.displayName ?? message.authorUserId
                  }`,
                  body: message.stringContent,
                  icon:
                    message.author == null
                      ? undefined
                      : message.author.profilePicture?.small ??
                        module.generatePlaceholderAvatarDataUri(
                          message.author.walletAddress
                        ),
                  onClick: ({ close }) => {
                    navigate(`/channels/${channel.id}`);
                    window.focus();
                    close();
                  },
                });
              });

              break;
            }

            default: // Ignore
          }
        }
  );
};

const useUserEnsNames = () => {
  const actions = useActions();
  const selectors = useSelectors();
  const publicEthereumClient = usePublicEthereumClient();

  const { selectEnsName } = selectors;

  useAfterActionListener((action) => {
    switch (action.type) {
      case "fetch-users-request-successful":
      case "fetch-channel-members-request-successful":
        {
          const users = action.users ?? action.members;
          const accountAddressesWithUnknownEnsName = users
            .filter(
              (u) =>
                selectEnsName(u.walletAddress) === undefined &&
                u.walletAddress != null
            )
            .map((u) => u.walletAddress);

          if (accountAddressesWithUnknownEnsName.length === 0) break;

          actions.fetchEnsData(accountAddressesWithUnknownEnsName, {
            publicEthereumClient,
            avatars: false,
          });
        }
        break;

      default: // Ignore
    }
  });
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { status: authStatus } = useAuth();
  const selectors = useSelectors();
  const actions = useActions();
  const { login } = useWalletLogin();

  const [zoomSetting] = useSetting("zoom");

  useSystemNotifications();
  useUserEnsNames();

  useLocationRestorer((restoredPathname) => {
    if (location.pathname !== "/") return;

    const fallbackRedirect = () => navigate("/new", { replace: true });

    if (restoredPathname == null) {
      fallbackRedirect();
      return;
    }

    const match = matchPath({ path: "/channels/:channelId" }, restoredPathname);

    if (match == null) {
      fallbackRedirect();
      return;
    }

    navigate(restoredPathname, { replace: true });
  });

  useWalletEvent("disconnect", () => {
    if (authStatus === "not-authenticated") return;
    if (!confirm("Wallet disconnected. Do you wish to log out?")) return;
    actions.logout();
    navigate("/");
  });

  useWalletEvent("account-change", (newAddress) => {
    const me = selectors.selectMe();
    if (
      // We only care about logged in users
      authStatus === "not-authenticated" ||
      me?.walletAddress.toLowerCase() === newAddress.toLowerCase()
    )
      return;

    // Suggest login with new account
    if (
      !confirm(
        `Do you wish to login as ${truncateAddress(newAddress)} instead?`
      )
    )
      return;

    actions.logout();
    login(newAddress).then(() => {
      navigate("/");
    });
  });

  if (isReactNativeWebView) {
    const sendMessageToApp = (type, payload) =>
      window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload }));
    return (
      <LoginScreen
        mobileAppLogin
        onSuccess={({ accessToken, refreshToken }) => {
          sendMessageToApp("ns:authenticated", { accessToken, refreshToken });
        }}
        onError={() => {
          sendMessageToApp("ns:error");
        }}
      />
    );
  }

  return (
    <>
      <Global
        styles={(theme) =>
          css({
            html: {
              fontSize: {
                tiny: "0.546875em",
                small: "0.5859375em",
                large: "0.6640625em",
                huge: "0.703125em",
              }[zoomSetting],
            },
            body: {
              color: theme.colors.textNormal,
              background: theme.colors.backgroundPrimary,
              fontFamily: theme.fontStacks.default,
              "::selection": {
                background: theme.colors.textSelectionBackground,
              },
            },
          })
        }
      />

      {isNative && <TitleBar />}

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="/new" element={<NewMessageScreen />} />
          <Route path="/topics" element={<ChannelsScreen />} />
          <Route path="/channels/:channelId" element={<ChannelScreen />} />
        </Route>
        <Route path="/c/:channelId" element={<ChannelScreen noSideMenu />} />
        <Route
          path="/dm/:ensNameOrEthereumAccountAddress"
          element={<RedirectDmIntent />}
        />
        <Route
          path="/support"
          element={
            <ChannelBase noSideMenu channelId="638880b142d6c362cc0b7224" />
          }
        />
        <Route
          path="/oauth/authorize"
          element={
            <RequireAuth>
              <AuthScreen />
            </RequireAuth>
          }
        />
        <Route element={<Layout />}>
          <Route
            path="/:ensNameOrEthereumAccountAddress"
            element={<AccountProfileScreen />}
          />
        </Route>
        {/* <Route path="*" element={<Navigate to="/" replace />} /> */}
      </Routes>

      <CommandCenter />
      <GlobalDialogs />
    </>
  );
};

const CommandCenter = () => {
  const props = useCommandCenter();

  if (!props.isOpen) return null;

  return (
    <React.Suspense fallback={null}>
      <CommandCenterLazy {...props} />
    </React.Suspense>
  );
};

const RedirectDmIntent = () => {
  const { ensNameOrEthereumAccountAddress } = useParams();
  const navigate = useNavigate();
  const publicEthereumClient = usePublicEthereumClient();

  React.useEffect(() => {
    if (isEthereumAccountAddress(ensNameOrEthereumAccountAddress)) {
      navigate(`/new?account=${ensNameOrEthereumAccountAddress}`, {
        replace: true,
      });
      return;
    }

    publicEthereumClient
      .getEnsAddress({
        name: normalizeEnsName(ensNameOrEthereumAccountAddress),
      })
      .then((address) => {
        if (address == null) {
          navigate("/", { replace: true });
          return;
        }

        navigate(`/new?account=${address}`, { replace: true });
      });
  }, [navigate, publicEthereumClient, ensNameOrEthereumAccountAddress]);

  return null;
};

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

const searchParams = new URLSearchParams(location.search);

const themeMap = {
  dark: darkTheme,
  light: lightTheme,
  "nouns-tv": nounsTvTheme,
};

const useEffectOnce = (cb) => {
  const didRunRef = React.useRef(false);

  React.useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;
    cb();
  });
};

const LAST_VISITED_PATHNAME_CACHE_KEY = "last-visited-pathname";

const useLocationRestorer = (callback) => {
  const location = useLocation();
  const { writeAsync: cacheWrite, readAsync: cacheRead } = useCacheStore();

  useEffectOnce(() => {
    cacheRead(LAST_VISITED_PATHNAME_CACHE_KEY).then((pathname) => {
      callback(pathname);
    });
  });

  React.useEffect(() => {
    cacheWrite(LAST_VISITED_PATHNAME_CACHE_KEY, location.pathname);
  }, [location, cacheWrite]);
};

const useTheme = () => {
  const [themeSetting] = useSetting("theme");
  const systemPrefersDarkTheme = useMatchMedia("(prefers-color-scheme: dark)");

  const theme = React.useMemo(() => {
    const specifiedTheme = searchParams.get("theme");
    if (specifiedTheme) return themeMap[specifiedTheme] ?? defaultTheme;

    if (themeSetting === "system")
      return systemPrefersDarkTheme ? darkTheme : lightTheme;

    return themeMap[themeSetting] ?? defaultTheme;
  }, [themeSetting, systemPrefersDarkTheme]);

  return theme;
};

export default function LazyRoot() {
  const { state: authState } = useAuth();
  const { login } = useActions();
  const theme = useTheme();

  if (authState === "loading") return null;

  return (
    <BrowserRouter>
      <WagmiConfig config={wagmiConfig}>
        <WalletLoginProvider
          authenticate={({ message, signature, signedAt, address, nonce }) =>
            login({ message, signature, signedAt, address, nonce })
          }
        >
          <ThemeProvider theme={theme}>
            <Tooltip.Provider delayDuration={300}>
              <SidebarProvider>
                <DialogsProvider>
                  <CommandCenterProvider>
                    <EmojiProvider
                      loader={() =>
                        Promise.all([
                          import("@shades/common/emoji").then((m) =>
                            m.default.filter(
                              (e) =>
                                e.unicode_version === "" ||
                                parseFloat(e.unicode_version) <= 12
                            )
                          ),
                          import("@shades/common/custom-emoji").then(
                            (m) => m.default
                          ),
                        ]).then((sets) => sets.flat())
                      }
                    >
                      <App />
                    </EmojiProvider>
                  </CommandCenterProvider>
                </DialogsProvider>
              </SidebarProvider>
            </Tooltip.Provider>
          </ThemeProvider>
        </WalletLoginProvider>
      </WagmiConfig>
    </BrowserRouter>
  );
}

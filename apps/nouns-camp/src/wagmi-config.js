import {
  http,
  fallback,
  createConfig,
  cookieStorage,
  createStorage,
  cookieToInitialState,
} from "wagmi";
import { mainnet, sepolia, goerli } from "wagmi/chains";
import {
  walletConnect,
  coinbaseWallet,
  safe,
  injected,
} from "wagmi/connectors";

export const config = createConfig({
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
  chains: [mainnet, sepolia, goerli],
  connectors: [
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID,
    }),
    coinbaseWallet({ appName: "Nouns Camp" }),
    safe(),
    injected(),
  ],
  transports: {
    [mainnet.id]: fallback(
      http(
        `https://eth-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      ),
      http(
        `https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_PROJECT_ID}`,
      ),
    ),
    [sepolia.id]: fallback(
      http(
        `https://eth-sepolia.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
      ),
      http(
        `https://sepolia.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_PROJECT_ID}`,
      ),
    ),
    // Rainbow doesn’t seem to allow goerli anymore
    // [goerli.id]: http(
    //   `https://eth-goerli.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`,
    // ),
  },
  batch: {
    multicall: {
      wait: 250,
      batchSize: 1024 * 8, // 8kb seems to be the max size for cloudflare
    },
  },
});

export const getStateFromCookie = (cookie) =>
  cookieToInitialState(config, cookie);

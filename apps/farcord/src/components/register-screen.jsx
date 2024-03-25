import React from "react";
import {
  useConnect,
  useAccount,
  useEnsName,
  useSwitchChain,
  useSimulateContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
  useReadContract,
  useSignTypedData,
} from "wagmi";
import {
  InsufficientFundsError,
  encodeAbiParameters,
  formatEther,
  formatUnits,
  isHex,
} from "viem";
import {
  DEFAULT_CHAIN_ID,
  ID_GATEWAY_EIP_712_DOMAIN,
  KEY_GATEWAY_EIP_712_DOMAIN,
  BUNDLER_CONTRACT_ADDRESS,
  ID_REGISTRATION_REQUEST_TYPE,
  ID_REGISTRY_ADDRESS,
  KEY_METADATA_TYPE,
  KEY_REGISTRY_ADD_TYPE,
  STORAGE_REGISTRY_ADDRESS,
} from "../utils/farcaster";
import Button from "@shades/ui-web/button";
import { css } from "@emotion/react";
import { bundlerRegistryAbi } from "../abis/farc-bundler";
import { storageRegistryAbi } from "../abis/farc-storage-registry";
import Spinner from "@shades/ui-web/spinner";
import { Small } from "./text";
import * as Tooltip from "@shades/ui-web/tooltip";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { idRegistryAbi } from "../abis/farc-id-registry";
import { Link, useNavigate } from "react-router-dom";
import useSigner from "./signer";
import useWalletEvent from "../hooks/wallet-event.js";
import useFarcasterAccount from "./farcaster-account";
import { track } from "@vercel/analytics";

const { truncateAddress } = ethereumUtils;

const { EDGE_API_BASE_URL } = import.meta.env;

const priceFormatter = new Intl.NumberFormat("en", {
  style: "currency",
  currency: "USD",
  // maximumSignificantDigits: 2,
});

const ethFormatter = new Intl.NumberFormat("en", {
  maximumSignificantDigits: 2,
});

const StepElement = ({ collapsed = false, title, children }) => {
  return (
    <>
      <div
        css={css({
          textAlign: "left",
          display: "grid",
          gridTemplateRows: "auto",
          rowGap: "1rem",
          maxWidth: "50rem",
        })}
      >
        <h1
          css={(theme) =>
            css({
              fontSize: theme.fontSizes.headerLarge,
              color: collapsed
                ? theme.colors.textMuted
                : theme.colors.textHeader,
            })
          }
        >
          {title}
        </h1>

        {!collapsed && children}
      </div>
    </>
  );
};

const RegisterView = () => {
  const navigate = useNavigate();

  const { address: accountAddress, chain } = useAccount();
  const { data: accountEnsName } = useEnsName({ address: accountAddress });

  const { fid, reloadAccount } = useFarcasterAccount();

  const {
    connect,
    connectors,
    isLoading,
    variables: connectVariables,
    reset: cancelConnectionAttempt,
  } = useConnect({
    chainId: DEFAULT_CHAIN_ID,
  });

  const { switchChainAsync: switchChain } = useSwitchChain();
  const switchToOptimismMainnet = () =>
    switchChain({ chainId: DEFAULT_CHAIN_ID });
  const [isSwitchingToOptimism, setSwitchingToOptimism] = React.useState(false);

  const [deadline, setDeadline] = React.useState(null);

  const [regSig, setRegSig] = React.useState(null);
  const [signerSig, setSignerSig] = React.useState(null);
  const [signerMetadata, setSignerMetadata] = React.useState(null);
  const [signer, setSigner] = React.useState(null);

  const [recoveryAddress, setRecoveryAddress] = React.useState();
  const hasRequiredRecoveryInput =
    Boolean(recoveryAddress) && isHex(recoveryAddress);
  const [hasPendingRecoveryRequest, setHasPendingRecoveryRequest] =
    React.useState(false);
  const [recoveryError, setRecoveryError] = React.useState(null);

  const [hasPendingSignerRequest, setHasPendingSignerRequest] =
    React.useState(false);
  const [signerError, setSignerError] = React.useState(null);

  const [hasPendingRegisterRequest, setHasPendingRegisterRequest] =
    React.useState(false);
  const [registerError, setRegisterError] = React.useState(null);
  const [registerTransaction, setRegisterTransaction] = React.useState(null);

  const [storageUnits, setStorageUnits] = React.useState(1);

  const { createSigner } = useSigner();

  const { data: storagePrices } = useReadContracts({
    contracts: [
      {
        address: STORAGE_REGISTRY_ADDRESS,
        abi: storageRegistryAbi,
        chainId: DEFAULT_CHAIN_ID,
        functionName: "unitPrice",
      },
      {
        address: STORAGE_REGISTRY_ADDRESS,
        abi: storageRegistryAbi,
        chainId: DEFAULT_CHAIN_ID,
        functionName: "usdUnitPrice",
      },
    ],
  });

  const { data: hasFid } = useReadContract({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryAbi,
    chainId: DEFAULT_CHAIN_ID,
    functionName: "idOf",
    args: [accountAddress],
    query: {
      enabled: Boolean(registerTransaction),
      watch: Boolean(registerTransaction),
    },
  });

  const {
    data: registerAccountSimulationResult,
    isSuccess: registerAccountSumulationSuccessful,
    error: registerAccountSimulationError,
  } = useSimulateContract({
    address: BUNDLER_CONTRACT_ADDRESS,
    abi: bundlerRegistryAbi,
    chainId: DEFAULT_CHAIN_ID,
    functionName: "register",
    args: [
      [accountAddress, recoveryAddress, Number(deadline), regSig],
      [[1, signer?.publicKey, 1, signerMetadata, Number(deadline), signerSig]],
      Number(storageUnits - 1),
    ],
    value: storagePrices ? BigInt(storageUnits) * storagePrices?.[0].result : 0,
    query: {
      enabled: Boolean(signerSig && regSig && signer && storagePrices),
    },
  });

  const isInsufficientFundsError =
    registerAccountSimulationError != null &&
    registerError instanceof InsufficientFundsError;

  const { writeContractAsync: writeContract } = useWriteContract();

  useWalletEvent("disconnect", () => {
    setRegSig(null);
    setSignerSig(null);
    setSignerMetadata(null);
    setSigner(null);
    setRecoveryAddress(null);
    setDeadline(null);
  });

  useWalletEvent("account-change", () => {
    setRegSig(null);
    setSignerSig(null);
    setSignerMetadata(null);
    setSigner(null);
    setRecoveryAddress(null);
    setDeadline(null);
  });

  const { signTypedDataAsync: signTypedData } = useSignTypedData();

  const createRecoveryAddressSignature = async () => {
    if (!recoveryAddress) return;

    let oneDayFromNow = Math.floor(Date.now() / 1000) + 86400;
    setDeadline(oneDayFromNow);

    try {
      const sig = await signTypedData({
        domain: ID_GATEWAY_EIP_712_DOMAIN,
        types: {
          Register: ID_REGISTRATION_REQUEST_TYPE,
        },
        primaryType: "Register",
        message: {
          to: accountAddress,
          recovery: recoveryAddress,
          nonce: 0n,
          deadline: Number(oneDayFromNow),
        },
      });
      setRegSig(sig);
    } catch (e) {
      console.error(e);
      setRecoveryError(e.message);
    }
  };

  const createSignerSignature = async () => {
    try {
      const createdSigner = await createSigner();
      setSigner(createdSigner);

      const [farcordSignatureResponse, farcordAccountResponse] =
        await Promise.all([
          fetch(`${EDGE_API_BASE_URL}/farc-app`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              key: createdSigner?.publicKey,
              deadline: Number(deadline),
            }),
          }).then((res) => res.json()),
          fetch(`${EDGE_API_BASE_URL}/farc-app`).then((res) => res.json()),
        ]);

      const metadata = encodeAbiParameters(KEY_METADATA_TYPE, [
        {
          requestFid: BigInt(farcordAccountResponse.data.fid),
          requestSigner: farcordAccountResponse.data.address,
          signature: farcordSignatureResponse.data.signature,
          deadline: BigInt(deadline),
        },
      ]);

      setSignerMetadata(metadata);

      const sig = await signTypedData({
        domain: KEY_GATEWAY_EIP_712_DOMAIN,
        types: {
          Add: KEY_REGISTRY_ADD_TYPE,
        },
        primaryType: "Add",
        message: {
          owner: accountAddress,
          keyType: 1,
          key: createdSigner?.publicKey,
          metadataType: 1,
          metadata: metadata,
          nonce: 0n,
          deadline: Number(deadline),
        },
      });
      setSignerSig(sig);
    } catch (e) {
      console.error(e);
      setSignerError(e.message);
    }
  };

  const createAccount = async () => {
    try {
      const hash = await writeContract(registerAccountSimulationResult.request);
      setRegisterTransaction(hash);
      track("Account created", { account: accountAddress });
    } catch (e) {
      console.error(e);
      setRegisterError(e.message);
    }
  };

  const handleCreateSignerClick = async () => {
    setHasPendingSignerRequest(true);
    setSignerError(null);
    try {
      await createSignerSignature();
      setHasPendingSignerRequest(false);
    } catch (e) {
      setSignerError(e.message);
      setHasPendingSignerRequest(false);
    }
  };

  const usdUnitPrice = storagePrices
    ? formatUnits(BigInt(storageUnits) * storagePrices?.[1]?.result, 8)
    : null;
  const ethUnitPrice = storagePrices
    ? formatEther(BigInt(storageUnits) * storagePrices?.[0]?.result)
    : null;

  const priceTag =
    usdUnitPrice && ethUnitPrice
      ? `${priceFormatter.format(usdUnitPrice)} (${ethFormatter.format(
          ethUnitPrice,
        )} ETH) + gas`
      : "loading...";

  const storageTag = storageUnits
    ? `Enough for ${ethFormatter.format(
        storageUnits * 5000,
      )} casts, ${ethFormatter.format(
        storageUnits * 2500,
      )} reactions, and ${ethFormatter.format(storageUnits * 2500)} follows`
    : "loading...";

  const { isLoading: isRegisterPending, isSuccess: isRegisterSuccess } =
    useWaitForTransactionReceipt({
      hash: registerTransaction,
    });

  const alreadyRegistered =
    !registerTransaction && fid && chain?.id == DEFAULT_CHAIN_ID;

  if (registerTransaction && hasFid) {
    reloadAccount();
  }

  React.useEffect(() => {
    const gotoProfilePage = () => {
      navigate({
        pathname: `/profile`,
      });
    };

    if (alreadyRegistered) {
      gotoProfilePage();
    }
  }, [navigate, alreadyRegistered]);

  return (
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
          overflow: "auto",
          alignItems: "center",
        })
      }
    >
      <div
        css={css({
          display: "grid",
          gridTemplateRows: "auto",
          alignItems: "center",
          justifyContent: "center",
          alignContent: "center",
          textAlign: "center",
          rowGap: "2rem",
          minHeight: "100vh",
          padding: "0 1rem",
        })}
      >
        {accountAddress == null && isLoading ? (
          <>
            <Spinner
              size="2.4rem"
              css={(t) => ({
                color: t.colors.textDimmed,
                margin: "0 auto 0",
              })}
            />
            <div>Requesting wallet address...</div>
            <Small>Check your wallet</Small>
            <Button size="medium" onClick={cancelConnectionAttempt}>
              Cancel
            </Button>
          </>
        ) : accountAddress == null ? (
          <div style={{ justifySelf: "center" }}>
            <h1
              css={(theme) =>
                css({
                  fontSize: theme.fontSizes.headerLarge,
                  color: theme.colors.textHeader,
                })
              }
            >
              Connect your wallet
            </h1>

            <Small style={{ marginTop: "1rem" }}>
              Connect the wallet you wish to associate a Farcaster account with.
            </Small>

            <div
              css={css({
                display: "grid",
                gridAutoFlow: "row",
                gridAutoRows: "auto",
                gridGap: "1.5rem",
                marginTop: "2rem",
                // justifyContent: "center",
              })}
            >
              {connectors.map((connector) => (
                <ConnectButton
                  key={connector.id}
                  connector={connector}
                  isConnecting={
                    isLoading &&
                    connector.id === connectVariables?.connector?.id
                  }
                  size="medium"
                  onClick={() =>
                    connect(
                      { chainId: DEFAULT_CHAIN_ID, connector },
                      {
                        onSuccess(data) {
                          track("Connect Wallet", {
                            account: data.accounts[0],
                            connector: connector.name,
                          });
                        },
                      },
                    )
                  }
                />
              ))}
            </div>
            {isLoading && (
              <>
                <Spinner
                  size="2.4rem"
                  css={(t) => ({
                    color: t.colors.textDimmed,
                    margin: "0 auto 2rem",
                  })}
                />
                <div style={{ marginBottom: "1rem" }}>
                  Requesting wallet address...
                </div>
                <Small>Check your wallet</Small>
              </>
            )}

            <div
              css={(t) =>
                css({
                  marginTop: "3rem",
                  paddingTop: "1rem",
                  borderTop: `1px solid ${t.colors.borderLighter}`,
                })
              }
            >
              <Link
                to="/login"
                css={(theme) =>
                  css({
                    fontSize: theme.text.sizes.base,
                    color: theme.colors.textDimmed,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                Already have a Farcaster account?
              </Link>
            </div>
          </div>
        ) : isSwitchingToOptimism ? (
          <div>
            <Spinner color="rgb(255 255 255 / 15%)" size="2.4rem" />
            <div>Requesting network change...</div>
            <Small>Check your wallet</Small>
            <Button
              size="medium"
              onClick={() => {
                setSwitchingToOptimism(false);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : chain.id != DEFAULT_CHAIN_ID ? (
          <>
            <div style={{ color: "#ffc874" }}>Network not supported</div>
            <Button
              size="larger"
              onClick={() => {
                setSwitchingToOptimism(true);
                switchToOptimismMainnet().then(
                  () => {
                    setSwitchingToOptimism(false);
                  },
                  (e) => {
                    // wallet_switchEthereumChain already pending
                    if (e.code === 4902) return;

                    setSwitchingToOptimism(false);
                  },
                );
              }}
            >
              Switch to Optimism
            </Button>
            <Small>
              Most farcaster on-chain transactions happen on{" "}
              <a
                href={"https://www.optimism.io/"}
                rel="noreferrer"
                target="_blank"
                css={(theme) =>
                  css({
                    color: theme.colors.textDimmed,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                Optimism
              </a>{" "}
              - an Ethereum L2 chain.
            </Small>
          </>
        ) : isRegisterPending ? (
          <div>
            <Spinner
              size="2.4rem"
              css={(t) => ({
                color: t.colors.textDimmed,
                margin: "0 auto 2rem",
              })}
            />
            <div style={{ marginBottom: "1rem" }}>
              Waiting for transaction to be processed...
            </div>
            <a
              href={`https://optimistic.etherscan.io/tx/${registerTransaction}`}
              rel="noreferrer"
              target="_blank"
              css={(theme) =>
                css({
                  fontSize: theme.text.sizes.base,
                  color: theme.colors.textDimmed,
                  ":hover": {
                    color: theme.colors.linkModifierHover,
                  },
                })
              }
            >
              {registerTransaction}
            </a>
          </div>
        ) : isRegisterSuccess ? (
          <div>
            <h2>Welcome to Farcaster! 🎉</h2>
            <Small>Your account was successfully created.</Small>

            {!hasFid ? (
              <>
                <Spinner
                  size="2.4rem"
                  css={(t) => ({
                    color: t.colors.textDimmed,
                    margin: "3rem auto 1rem",
                  })}
                />
                <Small>
                  Give it a second for your account to be broadcasted to the
                  Farcaster Network
                </Small>
              </>
            ) : (
              <Button
                style={{ marginTop: "2rem" }}
                onClick={() => navigate("/profile")}
                size="medium"
              >
                Fill my profile
              </Button>
            )}
          </div>
        ) : (
          <>
            <div
              css={(theme) =>
                css({
                  fontSize: theme.text.sizes.base,
                  color: theme.colors.textDimmed,
                  margin: "2rem 0",
                })
              }
            >
              Connected as{" "}
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <a
                    href={`https://optimistic.etherscan.io/address/${accountAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.link,
                        ":hover": {
                          color: theme.colors.linkModifierHover,
                        },
                      })
                    }
                  >
                    {accountEnsName == null ? (
                      truncateAddress(accountAddress)
                    ) : (
                      <>
                        {accountEnsName} ({truncateAddress(accountAddress)})
                      </>
                    )}
                  </a>
                </Tooltip.Trigger>
                <Tooltip.Content side="top" sideOffset={4}>
                  <div>
                    Click to see address on{" "}
                    <span
                      css={(theme) =>
                        css({
                          color: theme.colors.link,
                          marginBottom: "0.3rem",
                        })
                      }
                    >
                      optimistic.etherscan.io
                    </span>
                  </div>
                  <div css={(theme) => css({ color: theme.colors.textDimmed })}>
                    {accountAddress}
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            </div>

            <StepElement
              collapsed={regSig}
              done={regSig}
              title="1. Recovery address"
            >
              <Small>
                The recovery address is used as a backup if you ever lose access
                to the connected wallet ({truncateAddress(accountAddress)}) and
                want to transfer your{" "}
                <a
                  href="https://docs.farcaster.xyz/protocol/concepts.html#accounts"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      ":hover": {
                        color: theme.colors.linkModifierHover,
                      },
                    })
                  }
                >
                  Farcaster Account
                </a>{" "}
                to another wallet.
              </Small>

              <Small>
                The recommended is to use a cold wallet for this step.
              </Small>

              <form
                id="create-recovery-address-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setHasPendingRecoveryRequest(true);
                  setRecoveryError(null);
                  try {
                    await createRecoveryAddressSignature();
                  } finally {
                    setHasPendingRecoveryRequest(false);
                  }
                }}
                css={css({
                  flex: 1,
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                })}
              >
                <input
                  value={recoveryAddress ?? ""}
                  onChange={(e) => setRecoveryAddress(e.target.value)}
                  placeholder="0x1234...5678"
                  // type={"url"}
                  css={(t) =>
                    css({
                      padding: "1rem",
                      borderRadius: "0.3rem",
                      border: `1px solid ${t.colors.backgroundQuarternary}`,
                      background: "none",
                      fontSize: t.text.sizes.large,
                      width: "100%",
                      outline: "none",
                      fontWeight: t.text.weights.header,
                      margin: "1rem 0",
                      color: t.colors.textNormal,
                      "::placeholder": { color: t.colors.textMuted },
                    })
                  }
                />

                <Button
                  type="submit"
                  form="create-recovery-address-form"
                  size="medium"
                  isLoading={hasPendingRecoveryRequest}
                  disabled={
                    !hasRequiredRecoveryInput || hasPendingRecoveryRequest
                  }
                >
                  Set recovery address
                </Button>
                <Small style={{ textAlign: "center", marginTop: "1rem" }}>
                  You will be asked to sign a message (off-chain).
                </Small>

                {recoveryError && (
                  <Small
                    css={(t) =>
                      css({
                        marginTop: "0.5rem",
                        color: t.colors.textDanger,
                        textOverflow: "clip",
                      })
                    }
                  >
                    {recoveryError}
                  </Small>
                )}
              </form>
            </StepElement>

            <StepElement
              collapsed={signerSig || !regSig}
              done={signerSig}
              title="2. Connect farcord"
            >
              <Small>
                In order to interact with the Farcaster network you need to
                create a keypair, called a{" "}
                <a
                  href="https://docs.farcaster.xyz/protocol/concepts.html#signers"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  signer
                </a>
                . Signers are a set of keys used to sign transactions on your
                behalf.
              </Small>

              <Small>
                You can create multiple signers without any trouble. You can
                have a signer for Farcord, another one for Flink, and yet
                another one for Warpcast.
              </Small>

              <Button
                size="medium"
                onClick={async () => {
                  handleCreateSignerClick();
                }}
                isLoading={hasPendingSignerRequest}
                disabled={hasPendingSignerRequest}
                style={{ marginTop: "2rem" }}
              >
                Connect Farcord
              </Button>
              <Small style={{ textAlign: "center", marginTop: "1rem" }}>
                You will be asked to sign a message (off-chain).
              </Small>

              {signerError && (
                <Small
                  css={(t) =>
                    css({
                      marginTop: "0.5rem",
                      color: t.colors.textDanger,
                      textOverflow: "clip",
                    })
                  }
                >
                  {signerError}
                </Small>
              )}
            </StepElement>

            <StepElement
              collapsed={!signerSig || !regSig}
              title="3. Register new account"
            >
              <Small>
                In order to avoid spamming the network, creating an account with
                Farcaster costs money. This is used to rent storage space for
                your casts, likes, etc. - you can think of it as a cloud storage
                service.
              </Small>

              <Small>
                If you want to read more about this, you should check the
                Farcaster{" "}
                <a
                  href="https://docs.farcaster.xyz/protocol/concepts.html#storage"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  docs
                </a>{" "}
                or head over to{" "}
                <a
                  href="https://caststorage.com/"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  caststorage.com
                </a>
                .
              </Small>

              <div
                css={(t) =>
                  css({
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    rowGap: "1rem",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "2rem",
                    fontSize: t.text.sizes.small,
                  })
                }
              >
                <div>
                  <p>Your wallet</p>
                  <p
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.tiny,
                        color: t.colors.textMuted,
                      })
                    }
                  >
                    This is where the new{" "}
                    <a
                      href="https://docs.farcaster.xyz/protocol/concepts.html#accounts"
                      rel="noreferrer"
                      target="_blank"
                      css={(theme) =>
                        css({
                          color: theme.colors.textMuted,
                          ":hover": {
                            color: theme.colors.linkModifierHover,
                          },
                        })
                      }
                    >
                      Farcaster ID (or fid)
                    </a>{" "}
                    will be sent to.
                  </p>
                </div>
                <a
                  href={`https://optimistic.etherscan.io/address/${accountAddress}`}
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      textAlign: "right",
                      padding: "0.5rem",
                      color: theme.colors.textMuted,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  {truncateAddress(accountAddress)}
                </a>

                <div>
                  <p>Your recovery address</p>
                  <p
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.tiny,
                        color: t.colors.textMuted,
                      })
                    }
                  >
                    This wallet will be able to start the recovery process for
                    your account.
                  </p>
                </div>

                <a
                  href={`https://optimistic.etherscan.io/address/${recoveryAddress}`}
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      textAlign: "right",
                      padding: "0.5rem",
                      color: theme.colors.textMuted,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  {recoveryAddress ? truncateAddress(recoveryAddress) : ""}
                </a>

                <div>
                  <p>Storage units to rent</p>
                  <p
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.tiny,
                        color: t.colors.textMuted,
                      })
                    }
                  >
                    {storageTag}
                  </p>
                </div>
                <div css={css({ width: "5rem", justifySelf: "end" })}>
                  <input
                    value={storageUnits ?? 1}
                    onChange={(e) => setStorageUnits(e.target.value)}
                    type={"number"}
                    min={1}
                    css={(t) =>
                      css({
                        padding: "0.5rem",
                        borderRadius: "0.3rem",
                        border: `1px solid ${t.colors.backgroundQuarternary}`,
                        background: "none",
                        width: "100%",
                        textAlign: "right",
                        outline: "none",
                        color: t.colors.textNormal,
                        "::placeholder": { color: t.colors.textMuted },
                        "&::-webkit-outer-spin-button": { marginLeft: "1rem" },
                        "&::-webkit-inner-spin-button": { marginLeft: "1rem" },
                      })
                    }
                  />
                </div>
              </div>

              <Small css={css({ textAlign: "center", marginTop: "4rem" })}>
                The cost of creating an account now is{" "}
                <span
                  css={(t) =>
                    css({
                      fontWeight: t.text.weights.emphasis,
                      color: t.colors.textHighlight,
                    })
                  }
                >
                  {priceTag}
                </span>
              </Small>

              <Button
                size="medium"
                onClick={async () => {
                  setHasPendingRegisterRequest(true);
                  setRegisterError(null);
                  await createAccount().finally(() =>
                    setHasPendingRegisterRequest(false),
                  );
                }}
                isLoading={hasPendingRegisterRequest}
                disabled={
                  hasPendingRegisterRequest ||
                  !registerAccountSumulationSuccessful
                }
              >
                Register
              </Button>
              <Small style={{ textAlign: "center" }}>
                You will be asked to submit a transaction (
                <a
                  href={`https://optimistic.etherscan.io/address/${ID_REGISTRY_ADDRESS}`}
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.textMuted,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  on-chain
                </a>
                ).
              </Small>

              {(registerError || registerAccountSimulationError) && (
                <Small
                  css={(t) =>
                    css({
                      marginTop: "0.5rem",
                      color: t.colors.textDanger,
                      textOverflow: "ellipsis",
                      overflow: "hidden",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    })
                  }
                >
                  {isInsufficientFundsError
                    ? "Your wallet does not have enough funds. Make sure you have bridged some ETH to Optimism."
                    : registerAccountSimulationError
                      ? registerAccountSimulationError.message.slice(0, 300)
                      : registerError.slice(0, 200)}
                </Small>
              )}
            </StepElement>
          </>
        )}
      </div>
    </div>
  );
};

const ConnectButton = ({ connector, isConnecting, ...props }) => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    connector.getProvider().then((p) => {
      setReady(p != null);
    });
  }, [connector]);

  return (
    <Button size="medium" disabled={isConnecting || !ready} {...props}>
      {connector.name}
      {!ready ? " (unsupported)" : isConnecting ? " (connectig)" : null}
    </Button>
  );
};

export default RegisterView;

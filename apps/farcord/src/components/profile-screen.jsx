import React from "react";
import { css } from "@emotion/react";
import { useAccount, useSwitchChain, useSignTypedData } from "wagmi";
import useFarcasterAccount from "./farcaster-account";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "@shades/ui-web/avatar";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import Button from "@shades/ui-web/button";
import { Small } from "./text";
import { useLatestCallback } from "@shades/common/react";
import {
  fetchUsernameProofsByFid,
  setUserData,
  useUserData as useHubUserData,
} from "../hooks/hub";
import useSigner from "./signer";
import {
  DEFAULT_CHAIN_ID,
  ETHEREUM_MAINNET_CHAIN_ID,
} from "../utils/farcaster";
import { addDays } from "date-fns";
import FormattedDate from "./formatted-date";
import Input from "@shades/ui-web/input";
import { PlusCircle as PlusCircleIcon } from "@shades/ui-web/icons";
import { uploadImages } from "../utils/imgur";

const FARCASTER_FNAME_API_ENDPOINT = "https://fnames.farcaster.xyz";

const EIP_712_USERNAME_DOMAIN = {
  name: "Farcaster name verification",
  version: "1",
  chainId: 1,
  verifyingContract: "0xe3be01d99baa8db9905b33a3ca391238234b79d1",
};

export const EIP_712_USERNAME_PROOF = [
  { name: "name", type: "string" },
  { name: "timestamp", type: "uint256" },
  { name: "owner", type: "address" },
];

const AccountPreview = ({ displayName, bio, username }) => {
  const { fid } = useFarcasterAccount();
  const { signer } = useSigner();
  const userData = useHubUserData(fid);

  const [pfp, setPfp] = React.useState(null);

  const [imageUploadPending, setImageUploadPending] = React.useState(false);
  const [imageUploadError, setImageUploadError] = React.useState(null);

  const handleFileUpload = async (event) => {
    setImageUploadPending(true);
    setImageUploadError(null);
    const file = event.target.files[0];

    await uploadImages({ files: [file] })
      .then(async ([image]) => {
        const imageUrl = image.link;

        return await setUserData({
          fid,
          signer,
          dataType: "pfp",
          value: imageUrl,
        }).then(() => {
          setPfp(imageUrl);
        });
      })
      .catch((err) => {
        console.error(err);
        setImageUploadError(err);
      })
      .finally(() => {
        setImageUploadPending(false);
      });
  };

  React.useEffect(() => {
    if (!userData) return;
    setPfp(userData?.pfp);
  }, [userData]);

  return (
    <>
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "5rem auto",
          columnGap: "1rem",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "2.4rem",
          maxWidth: "40rem",
          justifySelf: "center",
        })}
      >
        <div
          css={(t) =>
            css({
              background: t.colors.borderLighter,
              width: "5rem",
              height: "5rem",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })
          }
        >
          <label htmlFor="file-input">
            {pfp || userData?.pfp ? (
              <Avatar
                url={pfp ?? userData?.pfp}
                size="5rem"
                css={(t) =>
                  css({
                    background: t.colors.borderLighter,
                    opacity: imageUploadPending ? 0.5 : 1,
                  })
                }
              />
            ) : (
              <PlusCircleIcon
                style={{ opacity: imageUploadPending ? 0.5 : 1 }}
              />
            )}
          </label>

          <input
            id="file-input"
            type="file"
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </div>

        <div
          css={() =>
            css({
              textAlign: "left",
            })
          }
        >
          <p>
            <span style={{ fontWeight: "bold" }}>
              {displayName ?? userData?.displayName}
            </span>{" "}
            <AccountPreviewPopoverTrigger
              fid={fid}
              username={username}
              css={(t) => css({ color: t.colors.textMuted })}
            />
          </p>
          <p>{bio ?? userData?.bio}</p>
        </div>
      </div>
      {imageUploadError && (
        <Small
          css={(t) =>
            css({
              marginTop: "0.5rem",
              color: t.colors.textDanger,
              textOverflow: "clip",
            })
          }
        >
          {imageUploadError.message}
        </Small>
      )}
    </>
  );
};

const ProfileView = () => {
  const navigate = useNavigate();
  const { address: accountAddress, chain } = useAccount();
  const { switchChainAsync: switchChain } = useSwitchChain();

  const { signTypedDataAsync: signTypedData } = useSignTypedData();

  const switchToEthereumMainnet = () =>
    switchChain({ chainId: ETHEREUM_MAINNET_CHAIN_ID });
  const switchToOptimismMainnet = () =>
    switchChain({ chainId: DEFAULT_CHAIN_ID });

  const { fid } = useFarcasterAccount();
  const { signer, broadcasted: onChain } = useSigner();

  const userData = useHubUserData(fid);

  const [username, setUsername] = React.useState(null);
  const [hasUsernameUpdatePending, setHasUsernameUpdatePending] =
    React.useState(false);
  const [usernameUpdateError, setUsernameUpdateError] = React.useState(null);
  const [usernameUpdateValue, setUsernameUpdateValue] = React.useState(null);
  const [isValidUsername, setIsValidUsername] = React.useState(
    Boolean(usernameUpdateValue)
  );
  const [usernameTimelock, setUsernameTimelock] = React.useState(null);

  const [displayName, setDisplayName] = React.useState(null);
  const [displayNameUpdateValue, setDisplayNameUpdateValue] = React.useState(
    userData?.displayName
  );
  const [displayNameUpdatePending, setDisplayNameUpdatePending] =
    React.useState(false);
  const [displayNameUpdateError, setDisplayNameUpdateError] =
    React.useState(null);

  const [bio, setBio] = React.useState(null);
  const [bioUpdateValue, setBioUpdateValue] = React.useState(null);
  const [bioUpdatePending, setBioUpdatePending] = React.useState(false);
  const [bioUpdateError, setBioUpdateError] = React.useState(null);

  const makeProof = async ({ username, accountAddress, proofTimestamp }) => {
    if (!proofTimestamp) {
      proofTimestamp = Math.floor(Date.now() / 1000);
    }

    const usernameProofClaim = {
      owner: accountAddress,
      name: username,
      timestamp: BigInt(proofTimestamp),
    };

    return usernameProofClaim;
  };

  const checkUsernameAvailability = useLatestCallback(async () => {
    if (!usernameUpdateValue) return;
    if (usernameUpdateValue == username) return;

    const response = await fetch(
      FARCASTER_FNAME_API_ENDPOINT + `/transfers?name=${usernameUpdateValue}`
    );
    const data = await response.json();
    const transfers = data?.transfers || [];

    return !(transfers.length >= 1);
  }, [usernameUpdateValue]);

  const registerUsernameChange = async () => {
    if (!usernameUpdateValue) return;
    const isAvailable = await checkUsernameAvailability();

    if (!isAvailable) {
      setUsernameUpdateError("Username is already taken");
      return;
    }

    try {
      await switchToEthereumMainnet();

      // first you need to unregister current username, if set
      const currentUsernameResponse = await fetch(
        `${FARCASTER_FNAME_API_ENDPOINT}/transfers/current?fid=${Number(fid)}`
      );
      const currentUsernameData = await currentUsernameResponse.json();
      const currentUsername = currentUsernameData?.transfer?.username;

      if (currentUsername) {
        const unregisterProofTimestamp = Math.floor(Date.now() / 1000);
        const unregisterProofClaim = await makeProof({
          username: currentUsername,
          accountAddress,
          proofTimestamp: unregisterProofTimestamp,
        });

        const unregisterSignature = await signTypedData({
          domain: EIP_712_USERNAME_DOMAIN,
          types: { UserNameProof: EIP_712_USERNAME_PROOF },
          primaryType: "UserNameProof",
          message: unregisterProofClaim,
        });

        // need to unregister fname before registering a new one
        const unregisterResponse = await fetch(
          FARCASTER_FNAME_API_ENDPOINT + "/transfers",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: currentUsername,
              from: Number(fid),
              to: 0,
              fid: Number(fid),
              owner: accountAddress,
              timestamp: unregisterProofTimestamp,
              signature: unregisterSignature,
            }),
          }
        );

        const unregisterData = await unregisterResponse.json();

        if (unregisterData?.error) {
          setUsernameUpdateError(unregisterData.error);
          return;
        }
      }

      const registerProofTimestamp = Math.floor(Date.now() / 1000);
      const usernameProofClaim = await makeProof({
        username: usernameUpdateValue,
        accountAddress,
        proofTimestamp: registerProofTimestamp,
      });

      const registerSignature = await signTypedData({
        domain: EIP_712_USERNAME_DOMAIN,
        types: { UserNameProof: EIP_712_USERNAME_PROOF },
        primaryType: "UserNameProof",
        message: usernameProofClaim,
      });

      const response = await fetch(
        FARCASTER_FNAME_API_ENDPOINT + "/transfers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: usernameUpdateValue,
            from: 0,
            to: Number(fid),
            fid: Number(fid),
            owner: accountAddress,
            timestamp: registerProofTimestamp,
            signature: registerSignature,
          }),
        }
      );

      const data = await response.json();

      if (data?.error) {
        setUsernameUpdateError(data.error);
        return;
      }

      try {
        const transfer = data?.transfers?.[0];

        // TODO: this is not updating well

        if (!transfer) {
          console.error("expected username", data);
          throw new Error("expected username");
        }

        setUsername(transfer.username);

        await setUserData({
          fid,
          signer,
          dataType: "username",
          value: transfer.username,
        });

        // need to push the proof
      } catch (e) {
        // if error occurs, reload page to hopefully fetch new username correctly
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
      setUsernameUpdateError(e.message);
    } finally {
      switchToOptimismMainnet();
    }
  };

  const handleDisplayNameSubmit = async (e) => {
    e.preventDefault();
    setDisplayNameUpdatePending(true);
    setDisplayNameUpdateError(null);

    return await setUserData({
      fid,
      signer,
      dataType: "displayName",
      value: displayNameUpdateValue,
    }).then(() => {
      setDisplayNameUpdatePending(false);
      setDisplayNameUpdateError(null);
      setDisplayName(displayNameUpdateValue);
    });
  };

  const handleBioSubmit = async (e) => {
    e.preventDefault();
    setBioUpdatePending(true);
    setBioUpdateError(null);

    return await setUserData({
      fid,
      signer,
      dataType: "bio",
      value: bioUpdateValue,
    }).then(() => {
      setBioUpdatePending(false);
      setBioUpdateError(null);
      setBio(bioUpdateValue);
    });
  };

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setUsernameUpdateError(null);
      checkUsernameAvailability().then((isAvailable) => {
        if (!usernameUpdateValue) return;
        if (usernameUpdateValue == username) return;
        if (!isAvailable) {
          setIsValidUsername(false);
          setUsernameUpdateError("Username is already taken");
        } else {
          setIsValidUsername(true);
        }
      });
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [usernameUpdateValue, checkUsernameAvailability, username]);

  React.useEffect(() => {
    if (fid == null) return;

    const fetchTransfers = async (fid) => {
      const response = await fetch(
        FARCASTER_FNAME_API_ENDPOINT + `/transfers?fid=${fid}`
      );
      const data = await response.json();

      const transfer = data?.transfers?.[data.transfers.length - 1];

      if (!transfer) return;

      const { timestamp } = transfer;
      const timelockDate = addDays(new Date(timestamp * 1000), 28);
      const pastTimelock = timelockDate < new Date();

      if (!pastTimelock) {
        setUsernameTimelock(timelockDate);
      }
    };

    fetchTransfers(fid);
  }, [fid]);

  React.useEffect(() => {
    if (!userData) return;

    const fetchProofs = async (fid) => {
      let finalUsername;
      let finalDatetime;
      await fetchUsernameProofsByFid({ fid }).then((proofs) => {
        for (const proof of proofs) {
          const proofOwner = proof.owner;
          if (proofOwner.toLowerCase() !== accountAddress.toLowerCase())
            continue;

          const namez = proof.name;

          if (finalDatetime && finalDatetime > proof.timestamp) continue;
          finalUsername = namez;
        }

        if (finalUsername) {
          setUserData({
            fid,
            signer,
            dataType: "username",
            value: finalUsername,
          });
        }
      });
    };

    setDisplayName(userData?.displayName);
    setDisplayNameUpdateValue(userData?.displayName);

    setBio(userData?.bio);
    setBioUpdateValue(userData?.bio);

    if (!userData?.username && signer && onChain) {
      fetchProofs(fid);
    } else {
      setUsername(userData?.username);
    }
    setUsernameUpdateValue(userData?.username);
  }, [userData, fid, accountAddress, signer, onChain]);

  if (chain?.unsupported) {
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
          <div style={{ color: "#ffc874" }}>Network not supported</div>
          <Button
            size="larger"
            onClick={() => {
              switchToOptimismMainnet().then(
                () => {},
                (e) => {
                  // wallet_switchEthereumChain already pending
                  if (e.code === 4902) return;
                }
              );
            }}
          >
            Switch to Optimism
          </Button>
        </div>
      </div>
    );
  }

  if (!fid) {
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
          <p>No farcaster account found in this wallet.</p>
          <Button onClick={() => navigate("/register")} size="medium">
            Create new account
          </Button>

          <Small>
            If you just finished creating an account and got the success
            message, try refreshing this page a couple of times.
          </Small>
        </div>
      </div>
    );
  }

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
        <AccountPreview
          displayName={displayName}
          bio={bio}
          username={username}
        />

        {(!signer || !onChain) && (
          <div>
            <Small css={(t) => css({ color: t.colors.textHighlight })}>
              Your account is{" "}
              <span style={{ fontWeight: "bold" }}>read-only</span>.{" "}
              <Link
                to="/profile/apps/new"
                preventScrollReset={true}
                css={(theme) =>
                  css({
                    color: theme.colors.textHighlight,
                    ":hover": {
                      color: theme.colors.linkModifierHover,
                    },
                  })
                }
              >
                Connect farcord
              </Link>{" "}
              to make edits.
            </Small>
          </div>
        )}

        <div>
          <form
            id="update-displayName-form"
            onSubmit={handleDisplayNameSubmit}
            css={css({
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            })}
          >
            <input
              value={displayNameUpdateValue ?? ""}
              onChange={(e) => setDisplayNameUpdateValue(e.target.value)}
              placeholder={
                displayNameUpdateValue ??
                userData?.displayName ??
                "Vitalik Buterin"
              }
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
              form="update-displayName-form"
              size="medium"
              isLoading={displayNameUpdatePending}
              disabled={
                displayNameUpdatePending ||
                displayName == displayNameUpdateValue ||
                !signer
              }
            >
              Update display name
            </Button>

            {displayNameUpdateError && (
              <Small
                css={(t) =>
                  css({
                    marginTop: "0.5rem",
                    color: t.colors.textDanger,
                    textOverflow: "clip",
                  })
                }
              >
                {displayNameUpdateError}
              </Small>
            )}
          </form>
        </div>

        <div>
          <form
            id="update-bio-form"
            onSubmit={handleBioSubmit}
            css={css({
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            })}
          >
            <Input
              multiline
              rows={3}
              value={bioUpdateValue ?? ""}
              type="text"
              onChange={(e) => setBioUpdateValue(e.target.value)}
              placeholder={
                bioUpdateValue ??
                userData?.bio ??
                "Tell other folks something about yourself..."
              }
              css={(t) =>
                css({
                  padding: "1rem",
                  borderRadius: "0.3rem",
                  border: `1px solid ${t.colors.backgroundQuarternary}`,
                  background: "none",
                  //   fontSize: t.text.sizes.large,
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
              form="update-bio-form"
              size="medium"
              isLoading={bioUpdatePending}
              disabled={bioUpdatePending || bio == bioUpdateValue || !signer}
            >
              Update bio
            </Button>

            {bioUpdateError && (
              <Small
                css={(t) =>
                  css({
                    marginTop: "0.5rem",
                    color: t.colors.textDanger,
                    textOverflow: "clip",
                  })
                }
              >
                {bioUpdateError}
              </Small>
            )}
          </form>
        </div>

        {accountAddress && (
          <div
            css={(t) =>
              css({
                marginTop: "5rem",
                borderTop: `1px solid ${t.colors.borderLighter}`,
                paddingTop: "5rem",
              })
            }
          >
            <form
              id="create-username-update-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setHasUsernameUpdatePending(true);
                setUsernameUpdateError(null);
                await registerUsernameChange().finally(() =>
                  setHasUsernameUpdatePending(false)
                );
              }}
              css={css({
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
              })}
            >
              {!username ? <h2>Set username</h2> : <h2>Update username</h2>}

              <Small>
                You can only change your username once every 28 days.
              </Small>
              <input
                value={usernameUpdateValue ?? ""}
                onChange={(e) => setUsernameUpdateValue(e.target.value)}
                placeholder="vitalik"
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
                form="create-username-update-form"
                size="medium"
                isLoading={hasUsernameUpdatePending}
                disabled={
                  !isValidUsername ||
                  hasUsernameUpdatePending ||
                  usernameTimelock ||
                  username == usernameUpdateValue ||
                  !signer
                }
              >
                {username ? "Update username" : "Set username"}
              </Button>
              {username != usernameUpdateValue && usernameTimelock && (
                <Small
                  css={(t) =>
                    css({
                      marginTop: "1rem",
                      color: usernameUpdateValue
                        ? t.colors.textHighlight
                        : t.colors.textDimmed,
                    })
                  }
                >
                  You can only change your username again on{" "}
                  <FormattedDate
                    value={usernameTimelock}
                    month="short"
                    day="numeric"
                    hour="numeric"
                    minute="numeric"
                  />
                  .
                </Small>
              )}

              {hasUsernameUpdatePending && (
                <>
                  {username ? (
                    <Small style={{ marginTop: "1rem" }}>
                      You will be asked to sign 2 messages to first unregister{" "}
                      <b>{username}</b> and then register{" "}
                      <b>{usernameUpdateValue}</b>
                    </Small>
                  ) : (
                    <Small style={{ marginTop: "1rem" }}>
                      Please check your wallet to sign the message
                    </Small>
                  )}
                </>
              )}

              {usernameUpdateError && (
                <Small
                  css={(t) =>
                    css({
                      marginTop: "0.5rem",
                      color: t.colors.textDanger,
                      textOverflow: "clip",
                    })
                  }
                >
                  {usernameUpdateError}
                </Small>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileView;

import { parseAbi, decodeEventLog } from "viem";
import React from "react";
import {
  useReadContract,
  useWriteContract,
  useSimulateContract,
  usePublicClient,
  useBlockNumber,
} from "wagmi";
import { unparse as unparseTransactions } from "../utils/transactions.js";
import { resolveIdentifier } from "../contracts.js";
import { useActions } from "../store.js";
import { useWallet } from "./wallet.js";
import useChainId from "./chain-id.js";
import useRegisterEvent from "./register-event.js";
import { useCurrentVotes } from "./token-contract.js";

const getContractAddress = (chainId) =>
  resolveIdentifier(chainId, "dao").address;

export const useProposalThreshold = () => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function proposalThreshold() public view returns (uint256)",
    ]),
    functionName: "proposalThreshold",
  });

  return data == null ? null : Number(data);
};

const useLatestProposalId = (accountAddress) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function latestProposalIds(address account) public view returns (uint256)",
    ]),
    functionName: "latestProposalIds",
    args: [accountAddress],
    query: {
      enabled: accountAddress != null,
    },
  });

  if (!isSuccess) return undefined;

  return data == null ? null : Number(data);
};

export const useDynamicQuorum = (proposalId) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function quorumVotes(uint256 proposalId) public view returns (uint256)",
    ]),
    functionName: "quorumVotes",
    args: [proposalId],
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

export const useCurrentDynamicQuorum = ({ againstVotes = 0 } = {}) => {
  const latestQuorumRef = React.useRef();

  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber({ watch: true, cache: 20_000 });

  const { data: adjustedTotalSupply } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function adjustedTotalSupply() public view returns (uint256)",
    ]),
    functionName: "adjustedTotalSupply",
  });
  const { data: quorumParams } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function getDynamicQuorumParamsAt(uint256) public view returns (uint16, uint16, uint32)",
    ]),
    functionName: "getDynamicQuorumParamsAt",
    args: [blockNumber],
    query: {
      enabled: blockNumber != null,
    },
  });
  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function dynamicQuorumVotes(uint256, uint256, (uint16, uint16, uint32)) public view returns (uint256)",
    ]),
    functionName: "dynamicQuorumVotes",
    args: [againstVotes, adjustedTotalSupply, quorumParams],
    query: {
      enabled: adjustedTotalSupply != null && quorumParams != null,
    },
  });

  React.useEffect(() => {
    if (isSuccess) latestQuorumRef.current = Number(data);
  });

  if (!isSuccess) return latestQuorumRef.current;

  return Number(data);
};

const useProposalState = (proposalId) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function state(uint256 proposalId) external view returns (uint8)",
    ]),
    functionName: "state",
    args: [proposalId],
    query: {
      enabled: proposalId != null,
    },
  });

  if (!isSuccess) return undefined;

  return [
    "pending",
    "active",
    "canceled",
    "defeated",
    "succeeded",
    "queued",
    "expired",
    "executed",
    "vetoed",
    "objection-period",
    "updatable",
  ][Number(data)];
};

export const useActiveProposalId = (accountAddress) => {
  const latestProposalId = useLatestProposalId(accountAddress);
  const state = useProposalState(latestProposalId);

  if (latestProposalId === undefined || state === undefined) return undefined;

  const isActive = [
    "updatable",
    "pending",
    "active",
    "objection-period",
  ].includes(state);

  return isActive ? latestProposalId : null;
};

export const useCanCreateProposal = () => {
  const { address: connectedAccountAddress } = useWallet();

  const numberOfVotes = useCurrentVotes(connectedAccountAddress);

  const proposalThreshold = useProposalThreshold();

  const hasActiveProposal =
    useActiveProposalId(connectedAccountAddress) != null;

  if (hasActiveProposal == null || proposalThreshold == null) return null;

  if (hasActiveProposal) return false;

  const hasEnoughVotes = numberOfVotes > proposalThreshold;

  return hasEnoughVotes;
};

export const useCastProposalVote = (
  proposalId,
  { support, reason, enabled = true },
) => {
  const chainId = useChainId();
  const { data: blockNumber } = useBlockNumber();
  const { address: accountAddress } = useWallet();
  const { addOptimitisicProposalVote } = useActions();
  const registerEvent = useRegisterEvent();

  const hasReason = reason != null && reason.trim() !== "";

  const {
    data: castVoteSimulationResult,
    isSuccess: castVoteSimulationSuccessful,
    error: castVoteSimulationError,
  } = useSimulateContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function castRefundableVote(uint256 proposalId, uint8 support) external",
    ]),
    functionName: "castRefundableVote",
    args: [Number(proposalId), support],
    query: {
      enabled: enabled && support != null && !hasReason,
    },
  });

  const {
    data: castVoteWithReasonSimulationResult,
    isSuccess: castVoteWithReasonSimulationSuccessful,
    error: castVoteWithReasonSimulationError,
  } = useSimulateContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function castRefundableVoteWithReason(uint256 proposalId, uint8 support, string calldata reason) external",
    ]),
    functionName: "castRefundableVoteWithReason",
    args: [Number(proposalId), support, reason],
    query: {
      enabled: enabled && support != null && hasReason,
    },
  });

  const simulationError =
    castVoteSimulationError || castVoteWithReasonSimulationError;

  const { writeContractAsync: writeContract } = useWriteContract();

  if (simulationError != null)
    console.warn("Unexpected simulation error", simulationError);

  if (hasReason && !castVoteWithReasonSimulationSuccessful) return null;
  if (!hasReason && !castVoteSimulationSuccessful) return null;

  return async () =>
    writeContract(
      hasReason
        ? castVoteWithReasonSimulationResult.request
        : castVoteSimulationResult.request,
    ).then((hash) => {
      const voterId = accountAddress.toLowerCase();

      addOptimitisicProposalVote(proposalId, {
        id: String(Math.random()),
        reason,
        support,
        createdBlock: blockNumber,
        voterId,
        voter: { id: voterId },
      });

      registerEvent("Vote successfully cast", {
        proposalId,
        hash,
        account: accountAddress,
      });

      return hash;
    });
};

export const useCreateProposal = () => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({ description, transactions }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId },
    );

    return writeContract({
      address: getContractAddress(chainId),
      abi: parseAbi([
        "function propose(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
      ]),
      functionName: "propose",
      args: [targets, values, signatures, calldatas, description],
    })
      .then((hash) => {
        registerEvent("Proposal successfully created", {
          account: accountAddress,
          hash,
        });

        return publicClient.waitForTransactionReceipt({ hash });
      })
      .then((receipt) => {
        const eventLog = receipt.logs[1];
        const decodedEvent = decodeEventLog({
          abi: parseAbi([
            "event ProposalCreatedWithRequirements(uint256 id, address proposer, address[] signers, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, uint256 updatePeriodEndBlock, uint256 proposalThreshold, uint256 quorumVotes, string description)",
          ]),
          data: eventLog.data,
          topics: eventLog.topics,
        });
        return decodedEvent.args;
      });
  };
};

export const useCreateProposalWithSignatures = () => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({ description, transactions, proposerSignatures }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId },
    );

    return writeContract({
      address: getContractAddress(chainId),
      abi: parseAbi([
        "function proposeBySigs((bytes sig, address signer, uint256 expirationTimestamp)[], address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description) public returns (uint256)",
      ]),
      functionName: "proposeBySigs",
      args: [
        proposerSignatures,
        targets,
        values,
        signatures,
        calldatas,
        description,
      ],
    })
      .then((hash) => {
        registerEvent("Proposal successfully created", {
          account: accountAddress,
          hash,
          signatures: true,
        });
        return publicClient.waitForTransactionReceipt({ hash });
      })
      .then((receipt) => {
        const eventLog = receipt.logs[1];
        const decodedEvent = decodeEventLog({
          abi: parseAbi([
            "event ProposalCreatedWithRequirements(uint256 id, address proposer, address[] signers, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, uint256 updatePeriodEndBlock, uint256 proposalThreshold, uint256 quorumVotes, string description)",
          ]),
          data: eventLog.data,
          topics: eventLog.topics,
        });
        return decodedEvent.args;
      });
  };
};

export const useUpdateSponsoredProposalWithSignatures = (proposalId) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({
    description,
    transactions,
    proposerSignatures,
    updateMessage,
  }) => {
    const { targets, values, signatures, calldatas } = unparseTransactions(
      transactions,
      { chainId },
    );

    return writeContract({
      address: getContractAddress(chainId),
      abi: parseAbi([
        "function updateProposalBySigs(uint256 proposalId, (bytes sig, address signer, uint256 expirationTimestamp)[], address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory updateMessage) external",
      ]),
      functionName: "updateProposalBySigs",
      args: [
        proposalId,
        proposerSignatures,
        targets,
        values,
        signatures,
        calldatas,
        description,
        updateMessage,
      ],
    }).then((hash) => {
      registerEvent("Proposal successfully updated", {
        account: accountAddress,
        hash,
        signatures: true,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
  };
};

export const useUpdateProposal = (proposalId) => {
  const { address: accountAddress } = useWallet();

  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const contractAddress = getContractAddress(chainId);

  const { writeContractAsync: writeContract } = useWriteContract();

  return async ({ description, transactions, updateMessage }) => {
    const write = () => {
      if (transactions == null)
        return writeContract({
          address: getContractAddress(chainId),
          abi: parseAbi([
            "function updateProposalDescription(uint256 proposalId, string memory description, string updateMessage) external",
          ]),
          functionName: "updateProposalDescription",
          args: [proposalId, description, updateMessage],
        });

      const { targets, values, signatures, calldatas } = unparseTransactions(
        transactions,
        { chainId },
      );

      if (description == null)
        return writeContract({
          address: getContractAddress(chainId),
          abi: parseAbi([
            "function updateProposalTransactions(uint256 proposalId, address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string updateMessage) external",
          ]),
          functionName: "updateProposalTransactions",
          args: [
            proposalId,
            targets,
            values,
            signatures,
            calldatas,
            updateMessage,
          ],
        });

      return writeContract({
        address: contractAddress,
        abi: parseAbi([
          "function updateProposal(uint256 proposalId, address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string updateMessage) external",
        ]),
        functionName: "updateProposal",
        args: [
          proposalId,
          targets,
          values,
          signatures,
          calldatas,
          description,
          updateMessage,
        ],
      });
    };

    return write().then((hash) => {
      registerEvent("Proposal successfully updated", {
        proposalId,
        account: accountAddress,
        hash,
      });
      return hash;
    });
  };
};

export const useCancelProposal = (proposalId, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: parseAbi(["function cancel(uint256 proposalId) external"]),
      functionName: "cancel",
      args: [proposalId],
      query: {
        enabled,
      },
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContract(simulationResult.request);
    registerEvent("Proposal successfully canceled", {
      account: accountAddress,
      hash,
    });
    return publicClient.waitForTransactionReceipt({ hash });
  };
};

export const useQueueProposal = (proposalId, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: parseAbi(["function queue(uint256 proposalId) external"]),
      functionName: "queue",
      args: [proposalId],
      query: {
        enabled,
      },
    });
  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) => {
      registerEvent("Proposal successfully queued", {
        account: accountAddress,
        hash,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
};

export const useExecuteProposal = (proposalId, { enabled = true } = {}) => {
  const { address: accountAddress } = useWallet();

  const publicClient = usePublicClient();
  const chainId = useChainId();
  const registerEvent = useRegisterEvent();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: parseAbi(["function execute(uint256 proposalId) external"]),
      functionName: "execute",
      args: [proposalId],
      query: {
        enabled,
      },
    });
  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) => {
      registerEvent("Proposal successfully executed", {
        account: accountAddress,
        hash,
      });
      return publicClient.waitForTransactionReceipt({ hash });
    });
};

export const useCancelSignature = (signature) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: parseAbi(["function cancelSig(bytes calldata sig) external"]),
      functionName: "cancelSig",
      args: [signature],
    });

  const { writeContractAsync: writeContract } = useWriteContract();

  if (!simulationSuccessful) return null;

  return () =>
    writeContract(simulationResult.request).then((hash) =>
      publicClient.waitForTransactionReceipt({ hash }),
    );
};

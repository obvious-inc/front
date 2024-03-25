import { parseAbi, isAddress } from "viem";
import {
  usePublicClient,
  useReadContract,
  useWriteContract,
  useSimulateContract,
} from "wagmi";
import { resolveIdentifier } from "../contracts.js";
import useChainId from "./chain-id.js";

const getContractAddress = (chainId) =>
  resolveIdentifier(chainId, "token").address;

export const useCurrentVotes = (accountAddress) => {
  const chainId = useChainId();

  const { data, isSuccess } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function getCurrentVotes(address account) external view returns (uint96)",
    ]),
    functionName: "getCurrentVotes",
    args: [accountAddress],
    query: {
      enabled: accountAddress != null,
    },
  });

  if (!isSuccess) return undefined;

  return Number(data);
};

export const usePriorVotes = ({ account, blockNumber, enabled = true }) => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function getPriorVotes(address account, uint256 block) public view returns (uint256)",
    ]),
    functionName: "getPriorVotes",
    args: [account, blockNumber],
    query: {
      enabled: enabled && account != null && blockNumber != null,
    },
  });

  return data == null ? null : Number(data);
};

export const useNounSeed = (nounId, { enabled = true } = {}) => {
  const chainId = useChainId();

  const { data } = useReadContract({
    address: getContractAddress(chainId),
    abi: parseAbi([
      "function seeds(uint256) public view returns (uint48,uint48,uint48,uint48,uint48)",
    ]),
    functionName: "seeds",
    args: [nounId],
    query: {
      enabled: enabled && nounId != null,
    },
  });

  if (data == null) return null;

  return {
    background: data[0],
    body: data[1],
    accessory: data[2],
    head: data[3],
    glasses: data[4],
  };
};

export const useSetDelegate = (address) => {
  const publicClient = usePublicClient();
  const chainId = useChainId();

  const { writeContractAsync } = useWriteContract();

  const { data: simulationResult, isSuccess: simulationSuccessful } =
    useSimulateContract({
      address: getContractAddress(chainId),
      abi: [
        {
          type: "function",
          name: "delegate",
          inputs: [{ type: "address" }],
          outputs: [],
        },
      ],
      functionName: "delegate",
      args: [address],
      query: {
        enabled: isAddress(address),
      },
    });

  if (!simulationSuccessful) return null;

  return async () => {
    const hash = await writeContractAsync(simulationResult.request);
    return publicClient.waitForTransactionReceipt({ hash });
  };
};

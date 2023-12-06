import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { parse as parseTransactions } from "./utils/transactions.js";

const customGraphEndpoint = new URLSearchParams(location.search).get(
  "nouns-subgraph"
);

const subgraphEndpointByChainId = {
  1: customGraphEndpoint ?? process.env.NOUNS_MAINNET_SUBGRAPH_URL,
  11155111:
    "https://api.studio.thegraph.com/proxy/49498/nouns-v3-sepolia/version/latest",
};

const parseTimestamp = (unixSeconds) => new Date(parseInt(unixSeconds) * 1000);

const VOTE_FIELDS = `
fragment VoteFields on Vote {
  id
  blockNumber
  blockTimestamp
  reason
  supportDetailed
  votes
  voter {
    id
  }
  proposal {
    id
  }
}`;

const CANDIDATE_FEEDBACK_FIELDS = `
fragment CandidateFeedbackFields on CandidateFeedback {
  id
  reason
  supportDetailed
  createdBlock
  createdTimestamp
  votes
  voter {
    id
    nounsRepresented {
      id
    }
  }
  candidate {
    id
  }
}`;

const PROPOSAL_FEEDBACK_FIELDS = `
fragment ProposalFeedbackFields on ProposalFeedback {
  id
  reason
  supportDetailed
  createdBlock
  createdTimestamp
  votes
  voter {
    id
    nounsRepresented {
      id
    }
  }
  proposal {
    id
  }
}`;

const CANDIDATE_CONTENT_SIGNATURE_FIELDS = `
fragment CandidateContentSignatureFields on ProposalCandidateSignature {
  reason
  canceled
  createdBlock
  createdTimestamp
  expirationTimestamp
  signer {
    id
    nounsRepresented {
      id
    }
  }
  content {
    id
  }
}`;

const DELEGATES_QUERY = `
${VOTE_FIELDS}
query {
  delegates(first: 1000, where: {nounsRepresented_: {}}) {
    id
    nounsRepresented {
      id
      seed {
        head
        glasses
        body
        background
        accessory
      }
      owner {
        id
        delegate {
          id
        }
      }
    }
    votes (first: 1000, orderBy: blockNumber, orderDirection: desc) {
      ...VoteFields
    }
    proposals (first: 1000, orderBy: createdBlock, orderDirection: desc) {
      id
      description
      title
      status
      createdBlock
      createdTimestamp
      startBlock
      proposer {
        id
      }
    }
  }
}`;

const createDelegateQuery = (id) => `
  ${VOTE_FIELDS}
  query {
    delegate(id: "${id}") {
      id
      nounsRepresented {
        id
        seed {
          head
          glasses
          body
          background
          accessory
        }
        owner {
          id
          delegate {
            id
          }
        }
      }
      votes (first: 1000, orderBy: blockNumber, orderDirection: desc) {
        ...VoteFields
      }
      proposals (first: 1000, orderBy: createdBlock, orderDirection: desc) {
        id
        description
        title
        status
        createdBlock
        createdTimestamp
        lastUpdatedBlock
        lastUpdatedTimestamp
        startBlock
        endBlock
        updatePeriodEndBlock
        objectionPeriodEndBlock
        canceledBlock
        canceledTimestamp
        queuedBlock
        queuedTimestamp
        executedBlock
        executedTimestamp
        forVotes
        againstVotes
        abstainVotes
        quorumVotes
        executionETA
        proposer {
          id
        }
      }
    }
}`;

const createBrowseScreenQuery = ({ skip = 0, first = 1000 } = {}) => `
${VOTE_FIELDS}
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposals(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    description
    title
    status
    createdBlock
    createdTimestamp
    lastUpdatedBlock
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    canceledBlock
    canceledTimestamp
    queuedBlock
    queuedTimestamp
    executedBlock
    executedTimestamp
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    executionETA
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
  }

  proposalCandidates(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}) {
    id
    slug
    proposer
    createdBlock
    canceledBlock
    lastUpdatedBlock
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          ...CandidateContentSignatureFields
        }
      }
    }
  }
}`;

const createVoterScreenQuery = (id, { skip = 0, first = 1000 } = {}) => `
${VOTE_FIELDS}
${CANDIDATE_FEEDBACK_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposals(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}, where: {proposer: "${id}"} ) {
    id
    description
    title
    status
    createdBlock
    createdTimestamp
    lastUpdatedBlock
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    canceledBlock
    canceledTimestamp
    queuedBlock
    queuedTimestamp
    executedBlock
    executedTimestamp
    forVotes
    againstVotes
    abstainVotes
    quorumVotes
    executionETA
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
  }

  proposalCandidates(orderBy: createdBlock, orderDirection: desc, skip: ${skip}, first: ${first}, where: {proposer: "${id}"}) {
    id
    slug
    proposer
    createdBlock
    canceledBlock
    lastUpdatedBlock
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          ...CandidateContentSignatureFields
        }
      }
    }
  }
  votes (orderBy: blockNumber, orderDirection: desc, skip: ${skip}, first: ${first}, where: {voter: "${id}"}) {
    ...VoteFields
  }
  candidateFeedbacks(skip: ${skip}, first: ${first}, where: {voter: "${id}"}) {
    ...CandidateFeedbackFields
  }
  proposalFeedbacks(skip: ${skip}, first: ${first}, where: {voter: "${id}"}) {
    ...ProposalFeedbackFields
  }
}`;

const createProposalCandidateSignaturesByAccountQuery = (
  id,
  { skip = 0, first = 1000 } = {}
) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidateSignatures(skip: ${skip}, first: ${first}, where: {signer: "${id}"}) {
    ...CandidateContentSignatureFields
  }
}`;

const createProposalCandidateVersionByContentIdsQuery = (contentIds) => `
query {
  proposalCandidateVersions(where: {content_in: [${contentIds.map(
    (id) => `"${id}"`
  )}]}) {
    id
    createdBlock
    createdTimestamp
    updateMessage
    proposal {
      id
    }
    content {
      id
    }
  }
}`;

const createProposalCandidateByLatestVersionIdsQuery = (versionIds) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidates(where: {latestVersion_in: [${versionIds.map(
    (id) => `"${id}"`
  )}]}) {
    id
    slug
    proposer
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    createdBlock
    canceledBlock
    lastUpdatedBlock
    latestVersion {
      id
      content {
        title
        description
        targets
        values
        signatures
        calldatas
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          ...CandidateContentSignatureFields
        }
      }
    }
    versions {
      id
    }
  }
}`;

const createProposalQuery = (id) => `
${VOTE_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
query {
  proposal(id: "${id}") {
    id
    status
    title
    description
    createdBlock
    createdTimestamp
    lastUpdatedBlock
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    canceledBlock
    canceledTimestamp
    queuedBlock
    queuedTimestamp
    executedBlock
    executedTimestamp
    targets
    signatures
    calldatas
    values
    forVotes
    againstVotes
    abstainVotes
    executionETA
    quorumVotes
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
    feedbackPosts {
      ...ProposalFeedbackFields
    }
  }

  proposalVersions(where: {proposal: "${id}"}) {
    createdAt
    createdBlock
    updateMessage
  }

  proposalCandidateVersions(
    where: {content_: {matchingProposalIds_contains: ["${id}"]}}
  ) {
    createdBlock
    createdTimestamp
    updateMessage
    proposal {
      id
    }
  }
}`;

const createProposalCandidateQuery = (id) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidate(id: "${id}") {
    id
    slug
    proposer
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    createdBlock
    canceledBlock
    lastUpdatedBlock
    latestVersion {
      id
      content {
        title
        description
        targets
        values
        signatures
        calldatas
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          ...CandidateContentSignatureFields
        }
      }
    }
    versions {
      id
    }
  }
}`;

const createProposalCandidatesByAccountQuery = (accountAddress) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidates(where: { proposer: "${accountAddress}" }) {
    id
    slug
    proposer
    createdBlock
    canceledBlock
    lastUpdatedBlock
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    latestVersion {
      id
      content {
        title
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          ...CandidateContentSignatureFields
        }
      }
    }
  }
}`;

const createProposalCandidateFeedbackPostsByCandidateQuery = (candidateId) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_:{id: "${candidateId}"}}) {
    ...CandidateFeedbackFields
  }
}`;

const createProposalsVersionsQuery = (proposalIds) => `{
  proposalVersions(where: {proposal_in: [${proposalIds.map(
    (id) => `"${id}"`
  )}]}) {
    createdAt
    createdBlock
    updateMessage
    proposal {
      id
    }
  }
}`;

const createProposalsQuery = (proposalIds) => `
${VOTE_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
query {
  proposals(where: {id_in: [${proposalIds.map((id) => `"${id}"`)}]}) {
    id
    status
    title
    description
    createdBlock
    createdTimestamp
    lastUpdatedBlock
    lastUpdatedTimestamp
    startBlock
    endBlock
    updatePeriodEndBlock
    objectionPeriodEndBlock
    canceledBlock
    canceledTimestamp
    queuedBlock
    queuedTimestamp
    executedBlock
    executedTimestamp
    targets
    signatures
    calldatas
    values
    forVotes
    againstVotes
    abstainVotes
    executionETA
    quorumVotes
    proposer {
      id
    }
    signers {
      id
    }
    votes {
      ...VoteFields
    }
    feedbackPosts {
      ...ProposalFeedbackFields
    }
  }
}`;

const createProposalCandidatesQuery = (candidateIds) => `
${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
query {
  proposalCandidates(where: {id_in: [${candidateIds.map((id) => `"${id}"`)}]}) {
    id
    slug
    proposer
    canceledTimestamp
    createdTimestamp
    lastUpdatedTimestamp
    createdBlock
    canceledBlock
    lastUpdatedBlock
    latestVersion {
      id
      content {
        title
        description
        targets
        values
        signatures
        calldatas
        matchingProposalIds
        proposalIdToUpdate
        contentSignatures {
          ...CandidateContentSignatureFields
        }
      }
    }
  }
}`;

const createProposalCandidateFeedbackPostsByCandidatesQuery = (
  candidateIds
) => `
${CANDIDATE_FEEDBACK_FIELDS}
query {
  candidateFeedbacks(where: {candidate_in: [${candidateIds.map(
    (id) => `"${id}"`
  )}]}, first: 1000) {
    ...CandidateFeedbackFields
  }
}`;

const createNounsActivityDataQuery = ({ startBlock, endBlock }) => `
${CANDIDATE_FEEDBACK_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
${VOTE_FIELDS}
query {
  candidateFeedbacks(where: {createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...CandidateFeedbackFields
  }
  proposalFeedbacks(where: {createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...ProposalFeedbackFields
  }
  votes(where: {blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...VoteFields
    proposal {
      id
    }
  }
}`;

const createVoterActivityDataQuery = (id, { startBlock, endBlock }) => `
${CANDIDATE_FEEDBACK_FIELDS}
${PROPOSAL_FEEDBACK_FIELDS}
${VOTE_FIELDS}
query {
  candidateFeedbacks(where: {voter: "${id}", createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...CandidateFeedbackFields
  }
  proposalFeedbacks(where: {voter: "${id}"createdBlock_gte: ${startBlock}, createdBlock_lte: ${endBlock}}, first: 1000) {
    ...ProposalFeedbackFields
  }
  votes(where: {voter: "${id}", blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...VoteFields
    proposal {
      id
    }
  }
}`;

const subgraphFetch = async ({
  endpoint,
  chainId,
  operationName,
  query,
  variables,
}) => {
  const url = endpoint ?? subgraphEndpointByChainId[chainId];

  if (url == null) throw new Error();

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operationName, query, variables }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => body.data);
};

const parseFeedbackPost = (post) => ({
  id: post.id,
  reason: post.reason,
  support: post.supportDetailed,
  createdBlock: BigInt(post.createdBlock),
  createdTimestamp: parseTimestamp(post.createdTimestamp),
  votes: Number(post.votes),
  proposalId: post.proposal?.id,
  candidateId: post.candidate?.id,
  voterId: post.voter.id,
  voter: post.voter,
});

const parseProposalVote = (v) => ({
  id: v.id,
  createdBlock: BigInt(v.blockNumber),
  createdTimestamp: parseTimestamp(v.blockTimestamp),
  reason: v.reason,
  support: v.supportDetailed,
  votes: Number(v.votes),
  voterId: v.voter.id,
  proposalId: v.proposal?.id,
});

const parseProposalVersion = (v) => ({
  updateMessage: v.updateMessage,
  createdBlock: BigInt(v.createdBlock),
  createdTimestamp: parseTimestamp(v.createdAt),
  proposalId: v.proposal?.id,
});

const parseProposal = (data, { chainId }) => {
  const parsedData = { ...data };

  // Block numbers
  for (const prop of [
    "createdBlock",
    "startBlock",
    "endBlock",
    "updatePeriodEndBlock",
    "objectionPeriodEndBlock",
    "lastUpdatedBlock",
    "canceledBlock",
    "executedBlock",
    "queuedBlock",
  ]) {
    if (data[prop] === "0") {
      parsedData[prop] = null;
    } else if (data[prop] != null) {
      parsedData[prop] = BigInt(data[prop]);
    }
  }

  // Timestamps
  for (const prop of [
    "createdTimestamp",
    "lastUpdatedTimestamp",
    "canceledTimestamp",
    "executedTimestamp",
    "queuedTimestamp",
  ]) {
    if (data[prop] != null) {
      parsedData[prop] = parseTimestamp(data[prop]);
    }
  }

  // Regular numbers
  for (const prop of ["forVotes", "againstVotes", "abstainVotes"]) {
    if (data[prop] != null) {
      parsedData[prop] = Number(data[prop]);
    }
  }

  if (data.description != null) {
    const firstLine = data.description.split("\n")[0];
    const startIndex = [...firstLine].findIndex((c) => c !== "#");
    parsedData.title =
      startIndex === 0 ? null : firstLine.slice(startIndex).trim();
  }

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  if (data.versions != null)
    parsedData.versions = data.versions.map(parseProposalVersion);

  if (data.votes != null)
    parsedData.votes = data.votes
      .map(parseProposalVote)
      .filter((v) => !hideProposalVote(v));

  if (data.proposer?.id != null) parsedData.proposerId = data.proposer.id;

  if (data.targets != null)
    parsedData.transactions = parseTransactions(data, { chainId });

  return parsedData;
};

const hideProposalVote = (v) =>
  v.votes === 0 && (v.reason?.trim() ?? "") === "";

const parseProposalCandidate = (data, { chainId }) => {
  const parsedData = {
    ...data,
    latestVersion: {
      ...data.latestVersion,
      content: { ...data.latestVersion.content },
    },
  };

  parsedData.proposerId = data.proposer;

  // Block numbers
  for (const prop of ["createdBlock", "canceledBlock", "lastUpdatedBlock"]) {
    if (data[prop] === "0") {
      parsedData[prop] = null;
    } else if (data[prop] != null) {
      parsedData[prop] = BigInt(data[prop]);
    }
  }

  // Timestamps
  for (const prop of [
    "createdTimestamp",
    "lastUpdatedTimestamp",
    "canceledTimestamp",
  ]) {
    if (data[prop] != null) {
      parsedData[prop] = parseTimestamp(data[prop]);
    }
  }

  if (data.latestVersion.content.matchingProposalIds != null)
    parsedData.latestVersion.proposalId =
      data.latestVersion.content.matchingProposalIds[0];

  if ((data.latestVersion.content.proposalIdToUpdate ?? "0") !== "0")
    parsedData.latestVersion.targetProposalId =
      data.latestVersion.content.proposalIdToUpdate;

  if (data.latestVersion.content.contentSignatures != null)
    parsedData.latestVersion.content.contentSignatures =
      data.latestVersion.content.contentSignatures.map((s) => ({
        ...s,
        createdBlock: BigInt(s.createdBlock),
        createdTimestamp: parseTimestamp(s.createdTimestamp),
        expirationTimestamp: parseTimestamp(s.expirationTimestamp),
      }));

  if (data.latestVersion.content.targets != null)
    parsedData.latestVersion.content.transactions = parseTransactions(
      data.latestVersion.content,
      { chainId }
    );

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = data.feedbackPosts.map(parseFeedbackPost);

  return parsedData;
};

const parseDelegate = (data) => {
  const parsedData = { ...data };

  parsedData.nounsRepresented = arrayUtils.sortBy(
    (n) => parseInt(n.id),
    data.nounsRepresented
      .map((n) => ({
        ...n,
        seed: objectUtils.mapValues((v) => parseInt(v), n.seed),
        ownerId: n.owner?.id,
        delegateId: n.owner?.delegate?.id,
      }))
      // Don’t include nouns delegated to other accounts
      .filter((n) => n.delegateId == null || n.delegateId === data.id)
  );

  if (data.votes != null) parsedData.votes = data.votes.map(parseProposalVote);

  if (data.proposals != null)
    parsedData.proposals = data.proposals.map(parseProposal);

  return parsedData;
};

export const fetchProposalsVersions = async (chainId, proposalIds) =>
  subgraphFetch({
    chainId,
    query: createProposalsVersionsQuery(proposalIds),
  }).then((data) => {
    if (data.proposalVersions == null)
      return Promise.reject(new Error("not-found"));
    return data.proposalVersions.map(parseProposalVersion);
  });

export const fetchProposals = async (chainId, proposalIds) => {
  if (!proposalIds || proposalIds.length == 0) return [];
  return subgraphFetch({
    chainId,
    query: createProposalsQuery(proposalIds),
  }).then((data) => {
    return data.proposals.map((p) => parseProposal(p, { chainId }));
  });
};

export const fetchProposalCandidates = async (chainId, candidateIds) => {
  if (!candidateIds || candidateIds.length == 0) return [];
  return subgraphFetch({
    chainId,
    query: createProposalCandidatesQuery(candidateIds),
  }).then((data) => {
    return data.proposalCandidates.map((c) =>
      parseProposalCandidate(c, { chainId })
    );
  });
};

export const fetchProposalCandidatesFeedbackPosts = async (
  chainId,
  candidateIds
) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidateFeedbackPostsByCandidatesQuery(candidateIds),
  }).then((data) => {
    if (data.candidateFeedbacks == null)
      return Promise.reject(new Error("not-found"));
    return data.candidateFeedbacks.map(parseFeedbackPost);
  });

export const fetchProposal = (chainId, id) =>
  subgraphFetch({ chainId, query: createProposalQuery(id) }).then((data) => {
    if (data.proposal == null) return Promise.reject(new Error("not-found"));
    const candidateId = data.proposalCandidateVersions[0]?.proposal.id;
    return parseProposal(
      { ...data.proposal, versions: data.proposalVersions, candidateId },
      { chainId }
    );
  });

export const fetchProposalCandidate = async (chainId, rawId) => {
  const id = rawId.toLowerCase();
  // TODO: merge these queries
  return Promise.all([
    subgraphFetch({
      chainId,
      query: createProposalCandidateQuery(id),
    }).then((data) => {
      if (data.proposalCandidate == null)
        return Promise.reject(new Error("not-found"));
      return data.proposalCandidate;
    }),
    subgraphFetch({
      chainId,
      query: createProposalCandidateFeedbackPostsByCandidateQuery(id),
    }).then((data) => {
      if (data.candidateFeedbacks == null)
        return Promise.reject(new Error("not-found"));
      return data.candidateFeedbacks;
    }),
  ]).then(([candidate, feedbackPosts]) =>
    parseProposalCandidate({ ...candidate, feedbackPosts }, { chainId })
  );
};

export const fetchDelegates = (chainId) =>
  subgraphFetch({ chainId, query: DELEGATES_QUERY }).then((data) =>
    data.delegates.map(parseDelegate)
  );

export const fetchDelegate = (chainId, id) =>
  subgraphFetch({
    chainId,
    query: createDelegateQuery(id?.toLowerCase()),
  }).then((data) => {
    if (data.delegate == null) return Promise.reject(new Error("not-found"));
    return parseDelegate(data.delegate);
  });

export const fetchProposalCandidatesByAccount = (chainId, accountAddress) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidatesByAccountQuery(accountAddress),
  }).then((data) => {
    const candidates = data.proposalCandidates.map((c) =>
      parseProposalCandidate(c, { chainId })
    );
    return candidates;
  });

export const fetchBrowseScreenData = (chainId, options) =>
  subgraphFetch({ chainId, query: createBrowseScreenQuery(options) }).then(
    (data) => {
      const proposals = data.proposals.map((p) =>
        parseProposal(p, { chainId })
      );
      const candidates = data.proposalCandidates.map((c) =>
        parseProposalCandidate(c, { chainId })
      );
      return { proposals, candidates };
    }
  );

export const fetchProposalCandidatesSponsoredByAccount = (
  chainId,
  id,
  options
) =>
  subgraphFetch({
    chainId,
    query: createProposalCandidateSignaturesByAccountQuery(
      id.toLowerCase(),
      options
    ),
  })
    .then((data) => {
      // Fetch signatures, then content IDs, and finally the candidate versions
      return arrayUtils.unique(
        data.proposalCandidateSignatures.map((s) => s.content.id)
      );
    })
    .then(async (contentIds) => {
      const data = await subgraphFetch({
        chainId,
        query: createProposalCandidateVersionByContentIdsQuery(contentIds),
      });

      const versionIds = data.proposalCandidateVersions.map((v) => v.id);
      return subgraphFetch({
        chainId,
        query: createProposalCandidateByLatestVersionIdsQuery(versionIds),
      }).then((data) => {
        const candidates = data.proposalCandidates.map((c) =>
          parseProposalCandidate(c, { chainId })
        );
        return candidates;
      });
    });

export const fetchVoterScreenData = (chainId, id, options) =>
  subgraphFetch({
    chainId,
    query: createVoterScreenQuery(id.toLowerCase(), options),
  }).then((data) => {
    const proposals = data.proposals.map((p) => parseProposal(p, { chainId }));
    const candidates = data.proposalCandidates.map((c) =>
      parseProposalCandidate(c, { chainId })
    );
    const votes = data.votes.map(parseProposalVote);
    const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
    const candidateFeedbackPosts =
      data.candidateFeedbacks.map(parseFeedbackPost);
    return {
      proposals,
      candidates,
      votes,
      proposalFeedbackPosts,
      candidateFeedbackPosts,
    };
  });

export const fetchNounsActivity = (chainId, { startBlock, endBlock }) =>
  subgraphFetch({
    chainId,
    query: createNounsActivityDataQuery({
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
    }),
  }).then((data) => {
    if (data.candidateFeedbacks == null)
      return Promise.reject(new Error("not-found"));

    const candidateFeedbackPosts =
      data.candidateFeedbacks.map(parseFeedbackPost);
    const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
    const votes = data.votes
      .map(parseProposalVote)
      .filter((v) => !hideProposalVote(v));

    return { votes, proposalFeedbackPosts, candidateFeedbackPosts };
  });

export const fetchVoterActivity = (
  chainId,
  voterAddress,
  { startBlock, endBlock }
) =>
  subgraphFetch({
    chainId,
    query: createVoterActivityDataQuery(voterAddress?.toLowerCase(), {
      startBlock: startBlock.toString(),
      endBlock: endBlock.toString(),
    }),
  }).then((data) => {
    const candidateFeedbackPosts =
      data.candidateFeedbacks.map(parseFeedbackPost);
    const proposalFeedbackPosts = data.proposalFeedbacks.map(parseFeedbackPost);
    const votes = data.votes.map(parseProposalVote);

    return { votes, proposalFeedbackPosts, candidateFeedbackPosts };
  });

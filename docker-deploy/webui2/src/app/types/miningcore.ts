export interface VarDiffConfig {
  minDiff?: number;
  maxDiff?: number;
  maxDelta?: number;
  targetTime?: number;
  retargetTime?: number;
  variancePercent?: number;
}

export interface PortConfig {
  name?: string;
  protocol?: string;
  listenAddress?: string;
  difficulty?: number;
  varDiff?: VarDiffConfig;
  tls?: boolean;
  tlsAuto?: boolean;
}

export interface PoolStats {
  connectedMiners?: number;
  poolHashrate?: number;
  sharesPerSecond?: number;
  totalPaid?: number;
  poolEffort?: number;
}

export interface NetworkStats {
  networkHashrate?: number;
  networkDifficulty?: number;
  blockHeight?: number;
  lastNetworkBlockTime?: string;
  connectedPeers?: number;
  rewardType?: string;
}

export interface TopMiner {
  miner: string;
  hashrate?: number;
  sharesPerSecond?: number;
}

export interface PaymentProcessing {
  enabled?: boolean;
  minimumPayment?: number;
  payoutScheme?: string;
  payoutSchemeConfig?: Record<string, unknown>;
}

export interface Pool {
  id: string;
  coin?: {
    name?: string;
    symbol?: string;
    algorithm?: string;
    family?: string;
    website?: string;
    market?: string;
  };
  ports?: Record<string, PortConfig>;
  poolStats?: PoolStats;
  networkStats?: NetworkStats;
  paymentProcessing?: PaymentProcessing;
  totalPaid?: number;
  totalBlocks?: number;
  totalConfirmedBlocks?: number;
  totalPendingBlocks?: number;
  poolEffort?: number;
  topMiners?: TopMiner[];
  lastPoolBlockTime?: string;
  blockReward?: number;
  poolFeePercent?: number;
  addressInfoLink?: string;
  [key: string]: unknown;
}

export interface BlockItem {
  blockHeight?: number;
  hash?: string;
  status?: string;
  confirmationProgress?: number;
  reward?: number;
  miner?: string;
  created?: string;
  [key: string]: unknown;
}

export interface PaymentItem {
  created?: string;
  amount?: number;
  address?: string;
  transactionConfirmationData?: string;
  type?: string;
  [key: string]: unknown;
}

export interface MinerWorkerStats {
  hashrate?: number;
  sharesPerSecond?: number;
  lastShare?: string;
  online?: boolean;
}

export interface MinerStatsResponse {
  miner?: string;
  pendingBalance?: number;
  totalPaid?: number;
  lastShare?: string;
  hashrate?: number;
  sharesPerSecond?: number;
  performanceSamples?: Array<{ created: string; hashrate: number; sharesPerSecond?: number }>;
  workers?: Record<string, MinerWorkerStats>;
  [key: string]: unknown;
}

export type AssetType = "platform" | "crypto";

export type AssetDefinition = {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  decimals: number;
  enabled: boolean;

  // Used for external market-data lookups.
  // Platform assets such as CCT do not have an external CMC ID.
  coinMarketCapId?: number;

  // CCT starts with an internal reference price.
  // This is NOT an external market price.
  initialPriceUsd?: number;

  description: string;
};

export const CCT_ASSET: AssetDefinition = {
  id: "cct",
  symbol: "CCT",
  name: "Crypto-com Token",
  type: "platform",
  decimals: 18,
  enabled: true,
  initialPriceUsd: 1,
  description:
    "Crypto-com Token (CCT) is the native internal platform asset of Crypto Com Exchange.",
};

export const SUPPORTED_ASSETS: AssetDefinition[] = [
  CCT_ASSET,

  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    type: "crypto",
    decimals: 8,
    enabled: true,
    coinMarketCapId: 1,
    description: "Bitcoin",
  },

  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    type: "crypto",
    decimals: 18,
    enabled: true,
    coinMarketCapId: 1027,
    description: "Ethereum",
  },

  {
    id: "tether",
    symbol: "USDT",
    name: "Tether",
    type: "crypto",
    decimals: 6,
    enabled: true,
    coinMarketCapId: 825,
    description: "Tether USD",
  },

  {
    id: "binance-coin",
    symbol: "BNB",
    name: "BNB",
    type: "crypto",
    decimals: 18,
    enabled: true,
    coinMarketCapId: 1839,
    description: "BNB",
  },

  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    type: "crypto",
    decimals: 9,
    enabled: true,
    coinMarketCapId: 5426,
    description: "Solana",
  },

  {
    id: "xrp",
    symbol: "XRP",
    name: "XRP",
    type: "crypto",
    decimals: 6,
    enabled: true,
    coinMarketCapId: 52,
    description: "XRP",
  },

  {
    id: "usd-coin",
    symbol: "USDC",
    name: "USDC",
    type: "crypto",
    decimals: 6,
    enabled: true,
    coinMarketCapId: 3408,
    description: "USDC",
  },

  {
    id: "cardano",
    symbol: "ADA",
    name: "Cardano",
    type: "crypto",
    decimals: 6,
    enabled: true,
    coinMarketCapId: 2010,
    description: "Cardano",
  },

  {
    id: "dogecoin",
    symbol: "DOGE",
    name: "Dogecoin",
    type: "crypto",
    decimals: 8,
    enabled: true,
    coinMarketCapId: 74,
    description: "Dogecoin",
  },

  {
    id: "avalanche",
    symbol: "AVAX",
    name: "Avalanche",
    type: "crypto",
    decimals: 18,
    enabled: true,
    coinMarketCapId: 5805,
    description: "Avalanche",
  },
];

export const TRADEABLE_ASSETS = SUPPORTED_ASSETS.filter(
  (asset) => asset.enabled,
);

export const EXTERNAL_MARKET_ASSETS = SUPPORTED_ASSETS.filter(
  (asset) => asset.enabled && asset.type === "crypto" && asset.coinMarketCapId,
);

export function getAssetById(id: string): AssetDefinition | undefined {
  return SUPPORTED_ASSETS.find((asset) => asset.id === id);
}

export function getAssetBySymbol(
  symbol: string,
): AssetDefinition | undefined {
  return SUPPORTED_ASSETS.find(
    (asset) => asset.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}
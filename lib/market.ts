// lib/market.ts

export const SUPPORTED_ASSETS = [
  "CCT",
  "BTC",
  "ETH",
  "USDT",
  "BNB",
  "SOL",
  "XRP",
  "USDC",
  "ADA",
  "DOGE",
  "AVAX",
] as const;

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

export type MarketPriceMap = Record<string, number>;

type BinanceTicker = {
  symbol?: string;
  price?: string;
};

type CoinGeckoResponse = Record<
  string,
  {
    usd?: number;
  }
>;

const BINANCE_ASSET_SYMBOLS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
  BNB: "BNBUSDT",
  SOL: "SOLUSDT",
  XRP: "XRPUSDT",
  ADA: "ADAUSDT",
  DOGE: "DOGEUSDT",
  AVAX: "AVAXUSDT",
  USDT: "USDTUSDT",
  USDC: "USDCUSDT",
};

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  AVAX: "avalanche-2",
  USDT: "tether",
  USDC: "usd-coin",
};

function isPositiveFiniteNumber(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

async function fetchJson<T>(
  url: string,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Market provider returned HTTP ${response.status}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBinancePrices(): Promise<MarketPriceMap> {
  const symbols = Object.values(BINANCE_ASSET_SYMBOLS).filter(
    (symbol) => symbol !== "USDTUSDT",
  );

  const url =
    "https://data-api.binance.vision/api/v3/ticker/price?symbols=" +
    encodeURIComponent(JSON.stringify(symbols));

  const rows = await fetchJson<BinanceTicker[]>(url);

  const prices: MarketPriceMap = {};

  for (const row of rows) {
    if (!row.symbol || !row.price) {
      continue;
    }

    const asset = Object.entries(BINANCE_ASSET_SYMBOLS).find(
      ([, symbol]) => symbol === row.symbol,
    )?.[0];

    const price = Number(row.price);

    if (asset && isPositiveFiniteNumber(price)) {
      prices[asset] = price;
    }
  }

  return prices;
}

async function fetchCoinGeckoPrices(): Promise<MarketPriceMap> {
  const ids = Object.values(COINGECKO_IDS).join(",");

  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    `?ids=${encodeURIComponent(ids)}` +
    "&vs_currencies=usd";

  const data = await fetchJson<CoinGeckoResponse>(url);

  const prices: MarketPriceMap = {};

  for (const [asset, id] of Object.entries(COINGECKO_IDS)) {
    const price = data?.[id]?.usd;

    if (isPositiveFiniteNumber(price)) {
      prices[asset] = price;
    }
  }

  return prices;
}

export async function getServerMarketPrices(): Promise<{
  prices: MarketPriceMap;
  sources: Record<string, string>;
  externalAvailable: boolean;
}> {
  const prices: MarketPriceMap = {
    CCT: 1,
    USDT: 1,
    USDC: 1,
  };

  const sources: Record<string, string> = {
    CCT: "internal",
    USDT: "stablecoin",
    USDC: "stablecoin",
  };

  // First provider.
  try {
    const binancePrices = await fetchBinancePrices();

    for (const [asset, price] of Object.entries(binancePrices)) {
      if (isPositiveFiniteNumber(price)) {
        prices[asset] = price;
        sources[asset] = "binance";
      }
    }
  } catch {
    // Continue to fallback provider.
  }

  // Fill anything still missing from CoinGecko.
  const missingAssets = SUPPORTED_ASSETS.filter(
    (asset) =>
      asset !== "CCT" &&
      asset !== "USDT" &&
      asset !== "USDC" &&
      !isPositiveFiniteNumber(prices[asset]),
  );

  if (missingAssets.length > 0) {
    try {
      const coinGeckoPrices = await fetchCoinGeckoPrices();

      for (const asset of missingAssets) {
        const price = coinGeckoPrices[asset];

        if (isPositiveFiniteNumber(price)) {
          prices[asset] = price;
          sources[asset] = "coingecko";
        }
      }
    } catch {
      // No provider available for the missing assets.
    }
  }

  const externalAvailable = SUPPORTED_ASSETS.some(
    (asset) =>
      asset !== "CCT" &&
      asset !== "USDT" &&
      asset !== "USDC" &&
      isPositiveFiniteNumber(prices[asset]),
  );

  return {
    prices,
    sources,
    externalAvailable,
  };
}
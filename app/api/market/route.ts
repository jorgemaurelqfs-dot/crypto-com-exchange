// app/api/market/route.ts

import { NextResponse } from "next/server";
import {
  getServerMarketPrices,
  SUPPORTED_ASSETS,
} from "@/lib/market";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ASSET_NAMES: Record<string, string> = {
  CCT: "CrownStone Token",
  BTC: "Bitcoin",
  ETH: "Ethereum",
  USDT: "Tether USD",
  BNB: "BNB",
  SOL: "Solana",
  XRP: "XRP",
  USDC: "USD Coin",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  AVAX: "Avalanche",
};

export async function GET() {
  try {
    const market = await getServerMarketPrices();

    const assets = SUPPORTED_ASSETS.map((symbol) => {
      const price = market.prices[symbol];

      return {
        symbol,
        name: ASSET_NAMES[symbol] ?? symbol,
        price: typeof price === "number" ? price : null,
        usdPrice: typeof price === "number" ? price : null,
        source: market.sources[symbol] ?? null,
        available: typeof price === "number" && price > 0,
      };
    });

    return NextResponse.json(
      {
        success: true,
        markets: assets,
        assets,
        data: assets,
        externalAvailable: market.externalAvailable,
        updatedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[MARKET_API_ERROR]", error);

    // CCT and stablecoins remain usable even if every external
    // provider is temporarily unavailable.
    const fallbackAssets = [
      {
        symbol: "CCT",
        name: ASSET_NAMES.CCT,
        price: 1,
        usdPrice: 1,
        source: "internal",
        available: true,
      },
      {
        symbol: "USDT",
        name: ASSET_NAMES.USDT,
        price: 1,
        usdPrice: 1,
        source: "stablecoin",
        available: true,
      },
      {
        symbol: "USDC",
        name: ASSET_NAMES.USDC,
        price: 1,
        usdPrice: 1,
        source: "stablecoin",
        available: true,
      },
    ];

    return NextResponse.json(
      {
        success: true,
        markets: fallbackAssets,
        assets: fallbackAssets,
        data: fallbackAssets,
        externalAvailable: false,
        updatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
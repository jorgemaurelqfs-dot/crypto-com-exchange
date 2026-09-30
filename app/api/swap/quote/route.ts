// app/api/swap/quote/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getServerMarketPrices,
  SUPPORTED_ASSETS,
} from "@/lib/market";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FEE_RATE = 0.005;
const QUOTE_VALID_SECONDS = 30;

type QuoteRequest = {
  fromAsset?: string;
  toAsset?: string;
  fromAmount?: number | string;
  slippage?: number | string;
};

function getSupabaseAdminCompatibleClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing.",
    );
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  return number;
}

function normalizeAsset(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const authorization =
      request.headers.get("authorization") ?? "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 },
      );
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication token is missing.",
        },
        { status: 401 },
      );
    }

    const supabase = getSupabaseAdminCompatibleClient(token);

    const {
      data: authData,
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      console.error("[SWAP_QUOTE_AUTH_ERROR]", authError);

      return NextResponse.json(
        {
          success: false,
          error: "Your session is invalid or has expired.",
        },
        { status: 401 },
      );
    }

    const body =
      (await request.json()) as QuoteRequest;

    const fromAsset = normalizeAsset(body.fromAsset);
    const toAsset = normalizeAsset(body.toAsset);

    const fromAmount = positiveNumber(body.fromAmount);

    if (!fromAsset || !toAsset) {
      return NextResponse.json(
        {
          success: false,
          error: "Both assets are required.",
        },
        { status: 400 },
      );
    }

    if (fromAsset === toAsset) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose two different assets.",
        },
        { status: 400 },
      );
    }

    if (!fromAmount) {
      return NextResponse.json(
        {
          success: false,
          error: "Enter a valid amount greater than zero.",
        },
        { status: 400 },
      );
    }

    if (
      !SUPPORTED_ASSETS.includes(
        fromAsset as (typeof SUPPORTED_ASSETS)[number],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported source asset: ${fromAsset}.`,
        },
        { status: 400 },
      );
    }

    if (
      !SUPPORTED_ASSETS.includes(
        toAsset as (typeof SUPPORTED_ASSETS)[number],
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported destination asset: ${toAsset}.`,
        },
        { status: 400 },
      );
    }

    /*
     * Slippage is accepted for UI compatibility.
     *
     * The authoritative database quote function currently has
     * no slippage parameter, so we do NOT pretend it is being
     * applied server-side here.
     */
    const requestedSlippage =
      Number(body.slippage);

    if (
      Number.isFinite(requestedSlippage) &&
      requestedSlippage >= 0 &&
      requestedSlippage <= 100
    ) {
      // Intentionally not used in the database calculation.
    }

    /*
     * IMPORTANT:
     * Never trust the browser's exchange rate.
     *
     * Get the price from our server-side market layer.
     */
    const {
      prices,
      sources,
    } = await getServerMarketPrices();

    const fromPrice = prices[fromAsset];
    const toPrice = prices[toAsset];

    if (
      !Number.isFinite(fromPrice) ||
      fromPrice <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `A current server price for ${fromAsset} is temporarily unavailable. Please try again.`,
        },
        { status: 503 },
      );
    }

    if (
      !Number.isFinite(toPrice) ||
      toPrice <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `A current server price for ${toAsset} is temporarily unavailable. Please try again.`,
        },
        { status: 503 },
      );
    }

    /*
     * Example:
     *
     * BTC -> ETH
     *
     * 1 BTC = $BTC
     * 1 ETH = $ETH
     *
     * Therefore:
     *
     * BTC/ETH rate = BTC USD price / ETH USD price
     */
    const exchangeRate =
      fromPrice / toPrice;

    if (
      !Number.isFinite(exchangeRate) ||
      exchangeRate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "The server could not calculate a valid exchange rate.",
        },
        { status: 503 },
      );
    }

    /*
     * This EXACTLY matches the current Supabase function:
     *
     * create_swap_quote(
     *   uuid,
     *   text,
     *   text,
     *   numeric,
     *   numeric,
     *   numeric,
     *   integer
     * )
     */
    const {
      data: quoteData,
      error: quoteError,
    } = await supabase.rpc(
      "create_swap_quote",
      {
        p_user_id: authData.user.id,
        p_from_asset: fromAsset,
        p_to_asset: toAsset,
        p_from_amount: fromAmount,
        p_exchange_rate: exchangeRate,
        p_fee_rate: FEE_RATE,
        p_valid_seconds: QUOTE_VALID_SECONDS,
      },
    );

    if (quoteError) {
      console.error(
        "[CREATE_SWAP_QUOTE_RPC_ERROR]",
        quoteError,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            quoteError.message ||
            "The server could not create the swap quote.",
          details:
            process.env.NODE_ENV === "development"
              ? quoteError
              : undefined,
        },
        { status: 400 },
      );
    }

    if (
      !quoteData ||
      typeof quoteData !== "object"
    ) {
      console.error(
        "[CREATE_SWAP_QUOTE_INVALID_DATA]",
        quoteData,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The swap service returned an empty quote.",
        },
        { status: 502 },
      );
    }

    const rawQuote = quoteData as Record<
      string,
      unknown
    >;

    const quoteId =
      rawQuote.quote_id ??
      rawQuote.id;

    if (!quoteId) {
      console.error(
        "[CREATE_SWAP_QUOTE_MISSING_ID]",
        quoteData,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The server created an incomplete swap quote.",
        },
        { status: 502 },
      );
    }

    const normalizedQuote = {
      ...rawQuote,

      /*
       * Keep BOTH names for compatibility with existing
       * frontend code.
       */
      id: String(quoteId),
      quote_id: String(quoteId),

      from_asset:
        String(rawQuote.from_asset ?? fromAsset).toUpperCase(),

      to_asset:
        String(rawQuote.to_asset ?? toAsset).toUpperCase(),

      from_amount:
        Number(
          rawQuote.from_amount ?? fromAmount,
        ),

      exchange_rate:
        Number(
          rawQuote.exchange_rate ?? exchangeRate,
        ),

      fee_rate:
        Number(
          rawQuote.fee_rate ?? FEE_RATE,
        ),

      fee_amount:
        Number(rawQuote.fee_amount ?? 0),

      receive_amount:
        Number(rawQuote.receive_amount ?? 0),

      expires_at:
        rawQuote.expires_at ?? null,

      market_source_from:
        sources[fromAsset] ?? null,

      market_source_to:
        sources[toAsset] ?? null,
    };

    if (
      !Number.isFinite(
        normalizedQuote.receive_amount,
      ) ||
      normalizedQuote.receive_amount <= 0
    ) {
      console.error(
        "[CREATE_SWAP_QUOTE_INVALID_RECEIVE_AMOUNT]",
        normalizedQuote,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The server returned an invalid receive amount.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        success: true,

        /*
         * Return the quote both at the top level and
         * inside `quote`.
         *
         * This makes the API tolerant of both frontend
         * response styles.
         */
        ...normalizedQuote,

        quote: normalizedQuote,
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
    console.error(
      "[SWAP_QUOTE_UNHANDLED_ERROR]",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to create swap quote.",
      },
      { status: 500 },
    );
  }
}
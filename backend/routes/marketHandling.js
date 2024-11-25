import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url); // Get the current file path
const __dirname = dirname(__filename); // Get the directory name from the file path

dotenv.config({ path: path.resolve(__dirname, "../.env") });
import express from "express";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE;
console.log(supabaseUrl);
console.log(supabaseKey);
const supabase = createClient(supabaseUrl, supabaseKey);

const router = express.Router();

async function createMarket(req, res) {
  try {
    if (
      !(
        req.body.description &&
        req.body.resolve_description &&
        req.body.options &&
        req.body.market_slug
      )
    ) {
      return res.status(400).json({ error: "Missing request body data" });
    }
    const { description, resolve_description, options, market_slug } = req.body;
    console.log(req.body);

    const { data, error } = await supabase
      .from("markets")
      .insert({
        description: description,
        resolve_description: resolve_description,
        market_slug: market_slug,
      })
      .select("market_id")
      .single(); // Grabbing the market_id and ensuring we get a single record

    console.log(data);
    if (error) {
      return res.status(400).json({ error: "market_slug already taken" });
    }
    const marketId = data.market_id; // Get the market_id from the inserted data

    const optionsInsertPromises = options.map((option) => {
      return supabase
        .from("options")
        .insert([{ market_id: marketId, option_string: option }]);
    });

    const optionsInsertResults = await Promise.all(optionsInsertPromises);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ market: data });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

async function getMarketData(req, res) {
  const { market_slug } = req.body;
  const { data: marketData, error: marketError } = await supabase
    .from("markets")
    .select("*")
    .eq("market_slug", market_slug)
    .single();

  if (marketError) {
    return res.status(400).json({ error: marketError.message });
  }

  const { data: tradesData, error: tradesError } = await supabase
    .from("trades")
    .select("option_id, bet_amount")
    .eq("market_id", marketData.market_id);

  if (tradesError) {
    return res.status(400).json({ error: tradesError.message });
  }

  const { data: optionsData, error: optionsError } = await supabase
    .from("options")
    .select("option_string, option_id")
    .eq("market_id", marketData.market_id);

  if (optionsError) {
    return res.status(400).json({ error: optionsError.message });
  }

  const optionBets = tradesData.reduce((acc, trade) => {
    const { option_id, bet_amount } = trade;
    const option = optionsData.find((opt) => opt.option_id === option_id);
    if (option) {
      const optionString = option.option_string;
      acc[optionString] = (acc[optionString] || 0) + bet_amount;
    }
    return acc;
  }, {});
  console.log(optionBets);

  return res.status(200).json({
    market: marketData,
    trades: tradesData,
    options: optionsData,
    aggregatedBets: optionBets,
  });
}

async function makeBet(req, res) {
  const { username, market_slug, bet_amount, option } = req.body;

  // Fetch the market data to ensure it exists
  const { data: marketData, error: marketError } = await supabase
    .from("markets")
    .select("*")
    .eq("market_slug", market_slug)
    .single();

  if (marketError || !marketData) {
    return res
      .status(400)
      .json({ error: marketError ? marketError.message : "Market not found" });
  }

  // Fetch the option ID based on the option string provided
  const { data: optionData, error: optionError } = await supabase
    .from("options")
    .select("option_id")
    .eq("option_string", option) // Assuming the column for the option string is 'option_name'
    .eq("market_id", marketData.market_id)
    .single();

  if (optionError || !optionData) {
    return res
      .status(400)
      .json({ error: optionError ? optionError.message : "Option not found" });
  }
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("user_id, balance")
    .eq("username", username)
    .single();

  if (userError || !userData) {
    return res
      .status(400)
      .json({ error: userError ? userError.message : "User not found" });
  }

  if (bet_amount > userData.balance) {
    return res
      .status(400)
      .json({ error: "Balance not sufficient to complete trade" });
  }
  const currentBalance = userData.balance;
  // Insert the bet into the trades table
  const { data: betData, error: betError } = await supabase
    .from("trades")
    .insert([
      {
        user_id: userData.user_id,
        market_id: marketData.market_id,
        bet_amount,
        option_id: optionData.option_id,
      },
    ]);

  if (betError) {
    return res.status(400).json({ error: betError.message });
  }
  const { data: adjBalance, error: adjBalanceErr } = await supabase
    .from("users")
    .update({ balance: currentBalance - bet_amount })
    .eq("user_id", userData.user_id);
  if (adjBalanceErr) {
    return res.status(400).json({ error: adjBalanceErr.message });
  }
  return res
    .status(201)
    .json({ message: "Bet placed successfully", bet: betData });
}
async function resolveMarket(req, res) {
  const { market_slug, option_string } = req.body;

  // Fetch the market data to get the market_id
  const { data: marketData, error: marketError } = await supabase
    .from("markets")
    .select("market_id")
    .eq("market_slug", market_slug)
    .single();

  if (marketError || !marketData) {
    return res
      .status(400)
      .json({ error: marketError ? marketError.message : "Market not found" });
  }

  // Fetch all trades for the market
  const { data: trades, error: tradesError } = await supabase
    .from("trades")
    .select("user_id, bet_amount, option_id")
    .eq("market_id", marketData.market_id);
  if (tradesError) {
    return res.status(400).json({ error: tradesError.message });
  }

  // Calculate total bets on the winning option
  const { data: options, error: optionsError } = await supabase
    .from("options")
    .select("option_id")
    .eq("option_string", option_string)
    .eq("market_id", marketData.market_id)
    .single();
  if (optionsError || !options) {
    return res.status(400).json({
      error: optionsError ? optionsError.message : "Option not found",
    });
  }

  const winningBets = trades.filter(
    (trade) => trade.option_id === options.option_id
  );

  // Calculate total bets in the market (regardless of win/loss)
  const { data: allBets, error: allBetsError } = await supabase
    .from("trades")
    .select("bet_amount")
    .eq("market_id", marketData.market_id);

  if (allBetsError) {
    return res.status(400).json({ error: allBetsError.message });
  }

  const totalBets = allBets.reduce((sum, trade) => sum + trade.bet_amount, 0);
  const totalWinningBets = winningBets.reduce(
    (sum, trade) => sum + trade.bet_amount,
    0
  );

  // Distribute winnings proportionally based on total bets
  const results = winningBets.map((trade) => {
    const proportion = trade.bet_amount / totalWinningBets;
    const payout = proportion * totalBets; // Payout based on total bets
    return { user_id: trade.user_id, payout };
  });

  // Update user balances
  for (const result of results) {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("balance")
      .eq("user_id", result.user_id)
      .single();

    if (userError) {
      return res.status(400).json({ error: userError.message });
    }

    const newBalance = user.balance + result.payout;

    const { error: updateError } = await supabase
      .from("users")
      .update({ balance: newBalance })
      .eq("user_id", result.user_id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }
  }

  // Delete the market, options, and trades
  await supabase.from("trades").delete().eq("market_id", marketData.market_id);
  await supabase.from("options").delete().eq("market_id", marketData.market_id);
  await supabase.from("markets").delete().eq("market_id", marketData.market_id);

  return res
    .status(200)
    .json({ message: "Market resolved and deleted successfully", results });
}

router.post("/create-market", createMarket);
router.post("/make-bet", makeBet);
router.get("/getMarketData", getMarketData);
router.post("/resolveMarket", resolveMarket);

export default router;

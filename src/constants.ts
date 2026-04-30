export const TREND_STRATEGY_PINE = `// @version=5
strategy("Institutional Trend Optimizer", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10, currency=currency.USD)

// ==========================================
// --- User Inputs ---
// ==========================================
grp_scoring = "Trade Quality Scoring"
score_threshold = input.int(70, "Min Entry Score Threshold", minval=0, maxval=100, group=grp_scoring)

grp_indicators = "Trend Indicators"
ema_fast_len = input.int(50, "Trend EMA (Fast)", group=grp_indicators)
ema_slow_len = input.int(200, "Baseline EMA (Slow)", group=grp_indicators)
rsi_len = input.int(14, "RSI Length", group=grp_indicators)
vol_ma_len = input.int(20, "Volume MA Length", group=grp_indicators)

grp_risk = "Adaptive Risk Management"
sl_atr_mult = input.float(1.5, "ATR Stop Multiplier", step=0.1, group=grp_risk)
tp_rr_ratio = input.float(2.0, "Take Profit (R:R)", step=0.1, group=grp_risk)
use_be = input.bool(true, "Auto Break-Even (1:1)", group=grp_risk)
cooldown_bars = input.int(5, "Bars Cooldown", group=grp_risk)

// --- Logic Params ---
rsi_center = 50
pullback_buffer = 0.01 // 1% buffer

// ==========================================
// --- Calculations ---
// ==========================================
ema_fast = ta.ema(close, ema_fast_len)
ema_slow = ta.ema(close, ema_slow_len)
rsi_val = ta.rsi(close, rsi_len)
atr = ta.atr(14)
vol_ma = ta.sma(volume, vol_ma_len)
[macd_line, signal_line, _] = ta.macd(close, 12, 26, 9)

// --- 1. Trend Scoring (0-30 pts) ---
trend_bullish = close > ema_slow and ema_fast > ema_slow
trend_bearish = close < ema_slow and ema_fast < ema_slow
trend_score = 0
if (trend_bullish or trend_bearish)
    trend_score += 15
    if (trend_bullish and ta.rising(ema_fast, 3)) or (trend_bearish and ta.falling(ema_fast, 3))
        trend_score += 15

// --- 2. Momentum Scoring (0-25 pts) ---
momentum_score = 0
if (trend_bullish and rsi_val > 50 and rsi_val < 70) or (trend_bearish and rsi_val < 50 and rsi_val > 30)
    momentum_score += 15
if (trend_bullish and macd_line > signal_line) or (trend_bearish and macd_line < signal_line)
    momentum_score += 10

// --- 3. Volume Scoring (0-20 pts) ---
volume_score = 0
if (volume > vol_ma)
    volume_score += 15
if (volume > vol_ma * 1.5)
    volume_score += 5

// --- 4. Volatility Scoring (0-15 pts) ---
vola_score = 0
vola_dist = atr / close
if (vola_dist > 0.001 and vola_dist < 0.01)
    vola_score += 15

// --- 5. Pullback Quality (0-10 pts) ---
pullback_score = 0
dist_to_ema = math.abs(close - ema_fast) / close
if (dist_to_ema < pullback_buffer)
    pullback_score += 10

total_score = trend_score + momentum_score + volume_score + vola_score + pullback_score

// --- Regime ---
is_trending = math.abs(ema_fast - ema_slow) / ema_slow > 0.005
regime_label = is_trending ? (ema_fast > ema_slow ? "BULL" : "BEAR") : "RANGE"

bars_since_last = ta.barssince(strategy.position_size[1] != 0 and strategy.position_size == 0)
can_trade = (na(bars_since_last) or bars_since_last >= cooldown_bars) and strategy.position_size == 0

// --- Execution ---
entry_allowed = total_score >= score_threshold and is_trending and can_trade

if (entry_allowed and trend_bullish)
    strategy.entry("Long", strategy.long, comment="Score: " + str.tostring(total_score))

if (entry_allowed and trend_bearish)
    strategy.entry("Short", strategy.short, comment="Score: " + str.tostring(total_score))

// --- Dynamic Exits ---
var float sl_level = na
var float tp_level = na
var bool active_be = false

if (strategy.position_size != 0 and strategy.position_size[1] == 0)
    active_be := false
    if (strategy.position_size > 0)
        sl_level := close - (atr * sl_atr_mult)
        tp_level := close + ((close - sl_level) * tp_rr_ratio)
    else
        sl_level := close + (atr * sl_atr_mult)
        tp_level := close - ((sl_level - close) * tp_rr_ratio)

if (strategy.position_size > 0 and use_be and not active_be)
    if (high >= strategy.position_avg_price + (strategy.position_avg_price - sl_level))
        sl_level := strategy.position_avg_price
        active_be := true

if (strategy.position_size < 0 and use_be and not active_be)
    if (low <= strategy.position_avg_price - (sl_level - strategy.position_avg_price))
        sl_level := strategy.position_avg_price
        active_be := true

if (strategy.position_size != 0)
    strategy.exit("Exit", stop=sl_level, limit=tp_level, comment_loss="SL", comment_profit="TP")

// --- Visuals ---
plot(ema_fast, "EMA Fast", color.new(color.blue, 50))
plot(ema_slow, "EMA Slow", color.new(color.orange, 0), 2)
bgcolor(is_trending ? color.new(color.gray, 95) : color.new(color.red, 95))
plotshape(entry_allowed and trend_bullish, "Long", shape.triangleup, location.belowbar, color.green, size=size.small)
plotshape(entry_allowed and trend_bearish, "Short", shape.triangledown, location.abovebar, color.red, size=size.small)
`;

export const RANGE_STRATEGY_PINE = `// @version=5
strategy("Mean Reversion Ranger", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10, currency=currency.USD)

// ==========================================
// --- User Inputs ---
// ==========================================
bb_len = input.int(20, "BB Length")
bb_mult = input.float(2.0, "BB StdDev Multiplier")
rsi_len = input.int(14, "RSI Length")
rsi_upper = input.int(70, "RSI Overbought")
rsi_lower = input.int(30, "RSI Oversold")

grp_risk = "Risk Management"
sl_atr_mult = input.float(1.5, "ATR Stop Multiplier", step=0.1, group=grp_risk)
tp_rr_ratio = input.float(2.0, "Take Profit (R:R)", step=0.1, group=grp_risk)
use_be = input.bool(true, "Auto Break-Even (1:1)", group=grp_risk)

// --- Calculations ---
[basis, upper, lower] = ta.bb(close, bb_len, bb_mult)
rsi_val = ta.rsi(close, rsi_len)
atr = ta.atr(14)

// --- Strategy Logic ---
long_condition = ta.crossunder(close, lower) and rsi_val < rsi_lower
short_condition = ta.crossover(close, upper) and rsi_val > rsi_upper

// --- Execution ---
entry_allowed = long_condition or short_condition

if (long_condition and strategy.position_size == 0 and entry_allowed)
    strategy.entry("Long", strategy.long, comment="BB Oversold")

if (short_condition and strategy.position_size == 0 and entry_allowed)
    strategy.entry("Short", strategy.short, comment="BB Overbought")

// --- Exit Logic ---
var float sl = na
var float tp = na

if (strategy.position_size != 0 and strategy.position_size[1] == 0)
    if (strategy.position_size > 0)
        sl := close - (atr * sl_atr_mult)
        tp := close + ((close - sl) * tp_rr_ratio)
    else
        sl := close + (atr * sl_atr_mult)
        tp := close - ((sl - close) * tp_rr_ratio)

if (strategy.position_size != 0)
    strategy.exit("Exit", stop=sl, limit=tp)

// --- Visuals ---
plot(basis, color=color.gray, title="BB Basis")
p1 = plot(upper, color=color.blue, title="BB Upper")
p2 = plot(lower, color=color.blue, title="BB Lower")
fill(p1, p2, color=color.new(color.blue, 90))
`;

export const CRYPTO_BREAKOUT_STRATEGY = `// @version=5
strategy("Crypto Momentum Breakout", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=15, currency=currency.USD)

// ==========================================
// --- User Inputs ---
// ==========================================
lookback = input.int(20, "Breakout Lookback")
vol_ma_len = input.int(20, "Volume MA Length")
vol_mult = input.float(2.0, "Volume Spike Mult")

grp_risk = "Risk Management"
sl_atr_mult = input.float(1.5, "ATR Stop Multiplier", step=0.1, group=grp_risk)
tp_rr_ratio = input.float(2.0, "Take Profit (R:R)", step=0.1, group=grp_risk)
use_be = input.bool(true, "Auto Break-Even (1:1)", group=grp_risk)

// --- Calculations ---
highest_high = ta.highest(high, lookback)
lowest_low = ta.lowest(low, lookback)
vol_ma = ta.sma(volume, vol_ma_len)
atr = ta.atr(14)

// --- Logic ---
long_break = high > highest_high[1] and volume > vol_ma * vol_mult
short_break = low < lowest_low[1] and volume > vol_ma * vol_mult

// --- Execution ---
entry_allowed = long_break or short_break

if (long_break and strategy.position_size == 0 and entry_allowed)
    strategy.entry("Long", strategy.long, comment="Breakout + Vol")

if (short_break and strategy.position_size == 0 and entry_allowed)
    strategy.entry("Short", strategy.short, comment="Breakout + Vol")

// --- Risk Management ---
var float sl = na
if (strategy.position_size != 0 and strategy.position_size[1] == 0)
    sl := strategy.position_size > 0 ? close - (atr * sl_atr_mult) : close + (atr * sl_atr_mult)

// Break-Even / trailing Logic
if (strategy.position_size > 0 and use_be)
    sl := math.max(sl, strategy.position_avg_price)
if (strategy.position_size < 0 and use_be)
    sl := math.min(sl, strategy.position_avg_price)

if (strategy.position_size != 0)
    strategy.exit("Exit", stop=sl)

// --- Visuals ---
plot(highest_high, color=color.green, style=plot.style_stepline)
plot(lowest_low, color=color.red, style=plot.style_stepline)
`;
;



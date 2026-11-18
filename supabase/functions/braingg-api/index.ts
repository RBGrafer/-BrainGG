
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUIZ_QUESTIONS = [
  { id: "sab_01", question: "Как называется игра, по мотивам которой создана коллекция BrainGG?", options: ["Steal a Brainrot", "Pet Simulator", "Brookhaven", "Doors"], answer: 0, explanation: "BrainGG вдохновлён коллекцией персонажей Steal a Brainrot." },
  { id: "sab_02", question: "Какой персонаж известен как акула в кроссовках?", options: ["John Pork", "Tralalero Tralala", "Meowl", "Skibidi Toilet"], answer: 1, explanation: "Tralalero Tralala — знаменитый акулий персонаж." },
  { id: "sab_03", question: "Как зовут персонажа-свинью с человеческим лицом?", options: ["Meowl", "John Pork", "Strawberry Elephant", "Dragon Cannelloni"], answer: 1, explanation: "Это John Pork." },
  { id: "sab_04", question: "Какой из этих персонажей сочетает кота и сову?", options: ["Meowl", "Bombardiro Crocodilo", "Ballerina Cappuccina", "Los Tralaleritos"], answer: 0, explanation: "Meowl — гибрид кота и совы." },
  { id: "sab_05", question: "Какой персонаж является огромным слоном с клубничной тематикой?", options: ["Dragon Cannelloni", "Strawberry Elephant", "Headless Horseman", "Lirili Larila"], answer: 1, explanation: "Это Strawberry Elephant." },
  { id: "sab_06", question: "Как называется персонаж-дракон из коллекции?", options: ["Dragon Cannelloni", "Cappuccino Assassino", "Noobini Pizzanini", "Trippi Troppi"], answer: 0, explanation: "Его имя — Dragon Cannelloni." },
  { id: "sab_07", question: "Какой персонаж связан с легендой о всаднике без головы?", options: ["Headless Horseman", "John Pork", "Meowl", "Bombardiro Crocodilo"], answer: 0, explanation: "Это Headless Horseman." },
  { id: "sab_08", question: "Как называется валюта баланса в BrainGG?", options: ["Robux", "Stars", "GG", "Gems"], answer: 2, explanation: "Внутренняя валюта BrainGG — GG." },
  { id: "sab_09", question: "Сколько бесплатных попыток викторины доступно каждый день?", options: ["1", "2", "3", "5"], answer: 2, explanation: "Каждому игроку доступно три ответа в день." },
  { id: "sab_10", question: "Что происходит с предметом после успешного открытия кейса?", options: ["Он удаляется", "Он попадает в инвентарь", "Он превращается в XP", "Он отправляется другому игроку"], answer: 1, explanation: "Выигранный предмет сохраняется в инвентаре." },
  { id: "sab_11", question: "Как называется персонаж с туалетной тематикой?", options: ["Skibidi Toilet", "Meowl", "La Grande Combinasion", "Trippi Troppi"], answer: 0, explanation: "Это Skibidi Toilet." },
  { id: "sab_12", question: "Как называется персонаж La Grande...?", options: ["La Grande Combinasion", "La Grande Pizza", "La Grande Meowl", "La Grande Dragon"], answer: 0, explanation: "Полное имя — La Grande Combinasion." },
];

const ALLOWED_CASES = [
  "Truckini Case",
  "Summer Case",
  "Bloody Case",
  "Crafting Case",
  "Legend Case",
  "Elite Case",
  "All In Strawberry Elephant",
  "All In Headless Horseman",
  // Старые названия оставлены для совместимости с ранее выданными кредитами.
  "Starter Case",
  "Lucky Case",
  "Epic Case",
  "Legendary Case",
] as const;

// Special cases are free while the corresponding Telegram condition is met.
// Their reward pools reuse existing cases to preserve the current drop engine.
const SPECIAL_CASES = {
  nick: { displayName: "NICK CASE", rewardCaseName: "Truckini Case" },
  free: { displayName: "FREE CASE", rewardCaseName: "Summer Case" },
  deposit: { displayName: "BrainGG CASE", rewardCaseName: "Summer Case" },
} as const;

// Keep the API response and the database claim policy aligned. NICK/FREE are
// independent 12-hour cases; BrainGG CASE is a separate rolling 7-day reward.
const SPECIAL_CASE_COOLDOWN_MS = {
  nick: 12 * 60 * 60 * 1000,
  free: 12 * 60 * 60 * 1000,
  deposit: 7 * 24 * 60 * 60 * 1000,
} as const;

function formatSpecialCooldown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(Number.isFinite(seconds) ? seconds : 0));
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.ceil((safeSeconds % 3600) / 60);
  if (days > 0) return `${days} дн. ${hours} ч.`;
  if (hours > 0) return `${hours} ч. ${minutes} мин.`;
  return `${Math.max(1, minutes)} мин.`;
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmac(key: Uint8Array, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      new TextEncoder().encode(message),
    ),
  );
}

async function verifyTelegram(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) return null;

  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = await hmac(
    new TextEncoder().encode("WebAppData"),
    botToken,
  );

  const calculatedHash = toHex(
    await crypto.subtle.sign(
      "HMAC",
      await crypto.subtle.importKey(
        "raw",
        secretKey,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      ),
      new TextEncoder().encode(dataCheckString),
    ),
  );

  if (calculatedHash.length !== receivedHash.length) return null;

  let difference = 0;

  for (let i = 0; i < calculatedHash.length; i++) {
    difference |=
      calculatedHash.charCodeAt(i) ^ receivedHash.charCodeAt(i);
  }

  if (difference !== 0) return null;

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);

  if (!authDate || now - authDate > 86400 || authDate > now + 60) {
    return null;
  }

  try {
    return JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
}

async function getFreeCaseCredits(supabase: any, telegramId: number) {
  const { data, error } = await supabase
    .from("player_free_case_credits")
    .select("case_name, amount")
    .eq("telegram_id", telegramId);

  if (error) {
    console.error("Free case credits loading failed:", error.message);
    throw error;
  }

  const credits = data ?? [];

  return {
    free_case_credits: credits,
    free_cases_total: credits.reduce(
      (sum: number, row: any) => sum + Number(row.amount || 0),
      0,
    ),
  };
}

async function findPlayerByPublicGameId(supabase: any, rawValue: string, columns: string) {
  const raw = String(rawValue || "").trim();
  const username = raw.replace(/^@/, "").trim();
  if (username) {
    const escapedUsername = username.replace(/[\\%_]/g, "\\$&");
    const { data, error } = await supabase.from("players").select(columns).ilike("username", escapedUsername).maybeSingle();
    if (error) return { data: null, error };
    if (data) return { data, error: null };
  }
  // Backwards compatibility: administrators can still use an old internal ID for accounts without a Telegram username.
  return await supabase.from("players").select(columns).eq("game_id", raw).maybeSingle();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  // Telegram webhook: pre-checkout and successful Stars payment.
  // Fail closed if Telegram sends the webhook header but the secret is not configured.
  const suppliedWebhookSecret = req.headers.get("x-telegram-bot-api-secret-token");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (suppliedWebhookSecret && !webhookSecret) {
    console.error("Telegram webhook rejected: TELEGRAM_WEBHOOK_SECRET is not configured");
    return respond({ error: "Webhook authentication is not configured" }, 503);
  }
  if (suppliedWebhookSecret && webhookSecret) {
    if (suppliedWebhookSecret !== webhookSecret) {
      return respond({ error: "Webhook unauthorized" }, 401);
    }
    try {
      const update = await req.json();
      const token = Deno.env.get("BOT_TOKEN");
      const url = Deno.env.get("SUPABASE_URL");
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (!token || !url || !service) return respond({ error: "Server configuration is incomplete" }, 500);
      const db = createClient(url, service);
      const telegramCall = async (method: string, payload: unknown) => {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!result.ok) throw new Error(result.description || `Telegram ${method} failed`);
        return result.result;
      };
      if (update.pre_checkout_query) {
        const query = update.pre_checkout_query;
        const orderId = String(query.invoice_payload || "");
        const { data: order } = await db.from("telegram_star_orders")
          .select("id, telegram_id, stars, status").eq("id", orderId).maybeSingle();
        const valid = Boolean(order && order.status === "pending" &&
          String(order.telegram_id) === String(query.from?.id) &&
          query.currency === "XTR" && Number(order.stars) === Number(query.total_amount));
        await telegramCall("answerPreCheckoutQuery", {
          pre_checkout_query_id: query.id,
          ok: valid,
          ...(valid ? {} : { error_message: "Счёт недействителен или уже обработан. Создайте новый." }),
        });
        return respond({ ok: true });
      }
      const payment = update.message?.successful_payment;
      if (payment) {
        const payload = String(payment.invoice_payload || "");
        const chargeId = String(payment.telegram_payment_charge_id || "");
        const stars = Number(payment.total_amount || 0);
        if (!payload || !chargeId || payment.currency !== "XTR" || !Number.isSafeInteger(stars) || stars < 1) {
          return respond({ error: "Invalid successful payment payload" }, 400);
        }
        const { error } = await db.rpc("credit_stars_payment", {
          p_order_id: payload, p_telegram_charge_id: chargeId,
          p_provider_charge_id: payment.provider_payment_charge_id || null,
          p_stars: stars, p_telegram_id: update.message?.from?.id,
        });
        if (error) {
          console.error("Stars credit failed:", error.message);
          return respond({ error: "Could not credit Stars payment" }, 500);
        }
      }
      return respond({ ok: true });
    } catch (error) {
      console.error("Telegram webhook error:", error);
      return respond({ error: "Webhook processing failed" }, 500);
    }
  }

  try {
    const botToken = Deno.env.get("BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const adminIds = (Deno.env.get("ADMIN_TELEGRAM_IDS") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (!botToken || !supabaseUrl || !serviceKey) {
      return respond(
        { error: "Server configuration is incomplete" },
        500,
      );
    }

    const body = await req.json();
    const initData = body?.initData;

    if (typeof initData !== "string" || !initData) {
      return respond({ error: "Telegram data is missing" }, 400);
    }

    const telegramUser = await verifyTelegram(initData, botToken);

    if (!telegramUser?.id || !Number.isSafeInteger(telegramUser.id)) {
      return respond(
        { error: "Invalid Telegram authentication" },
        401,
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const configuredOwnerId = (Deno.env.get("OWNER_TELEGRAM_ID") ?? "").trim();
    // The project reserves @RB_Grafer as its owner. Prefer the immutable Telegram ID secret;
    // the verified Telegram username is a backwards-compatible fallback for existing installs.
    const telegramUsername = String(telegramUser.username ?? "").replace(/^@/, "").toLowerCase();
    const isOwner = configuredOwnerId
      ? configuredOwnerId === String(telegramUser.id)
      : telegramUsername === "rb_grafer";
    const isAdmin = isOwner || adminIds.includes(String(telegramUser.id));

    const getActiveEvent = async () => {
      const { data: eventRow, error: eventError } = await supabase
        .from("game_global_state")
        .select("id, event_name, event_started_at, event_ends_at, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (eventError) throw eventError;
      if (!eventRow?.event_name || !eventRow?.event_ends_at || Date.parse(eventRow.event_ends_at) <= Date.now()) {
        if (eventRow?.event_name) {
          await supabase.from("game_global_state").update({
            event_name: null, event_started_at: null, event_ends_at: null, updated_at: new Date().toISOString(),
          }).eq("id", 1);
          await recordGlobalActivity({
            eventType: "event_ended",
            title: "Глобальное событие завершилось",
            description: `Событие ${eventRow.event_name} закончилось по общему таймеру.`,
            success: true,
          });
        }
        return null;
      }
      return eventRow;
    };

    // Every major game action is written to one shared community feed. Only the
    // verified public Telegram username is stored; Telegram IDs and private
    // account data are never exposed in this table. Feed failures never undo a
    // successful game action.
    const recordGlobalActivity = async (activity: {
      eventType: string; title: string; description?: string; username?: string | null;
      itemName?: string | null; caseName?: string | null; rarity?: string | null;
      valueGg?: number | null; success?: boolean | null;
    }) => {
      try {
        const usernameSource = activity.username !== undefined ? activity.username : telegramUser.username;
        const safeUsername = String(usernameSource ?? "").replace(/^@/, "").trim().slice(0, 32) || null;
        const safeValue = activity.valueGg == null ? null : Number(activity.valueGg);
        const { error: activityError } = await supabase.from("game_global_activity").insert({
          username: safeUsername,
          event_type: String(activity.eventType).slice(0, 32),
          title: String(activity.title).slice(0, 80),
          description: String(activity.description ?? "").slice(0, 240) || null,
          item_name: activity.itemName ? String(activity.itemName).slice(0, 120) : null,
          case_name: activity.caseName ? String(activity.caseName).slice(0, 100) : null,
          rarity: activity.rarity ? String(activity.rarity).slice(0, 40) : null,
          value_gg: safeValue != null && Number.isFinite(safeValue) && safeValue >= 0 ? safeValue : null,
          success: activity.success ?? null,
        });
        if (activityError) throw activityError;
        // Keep the public activity table compact without affecting the feed.
        await supabase.from("game_global_activity")
          .delete().lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      } catch (activityError) {
        console.warn("Global activity insert failed:", activityError instanceof Error ? activityError.message : activityError);
      }
    };

    const sendPlayerTelegramMessage = async (chatId: number | string, text: string) => {
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        });
        const result = await response.json();
        if (!result?.ok) console.warn("BrainGG deposit Telegram notification failed:", result?.description || "unknown error");
      } catch (notificationError) {
        console.warn("BrainGG deposit Telegram notification failed:", notificationError instanceof Error ? notificationError.message : notificationError);
      }
    };

    const getSpecialCaseAccess = async () => {
      const profileName = `${String(telegramUser.first_name || "")} ${String(telegramUser.last_name || "")}`.toLowerCase();
      const nickAllowed = profileName.includes("@brain_gg_bot");
      const nick = {
        allowed: nickAllowed,
        reason: nickAllowed
          ? "@Brain_GG_Bot найден в имени или фамилии Telegram."
          : "Добавь @Brain_GG_Bot в имя или фамилию Telegram, затем обнови проверку.",
      };

      let free = {
        allowed: false,
        reason: "Подпишись на Telegram-канал @Brainrot_GG.",
        checkAvailable: true,
      };
      try {
        const memberResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: "@Brainrot_GG", user_id: telegramUser.id }),
        });
        const memberPayload = await memberResponse.json();
        if (!memberResponse.ok || !memberPayload?.ok || !memberPayload?.result) {
          throw new Error(memberPayload?.description || "Telegram getChatMember failed");
        }
        const member = memberPayload.result;
        const isMember = ["creator", "administrator", "member"].includes(String(member.status || ""))
          || (member.status === "restricted" && member.is_member === true);
        free = {
          allowed: isMember,
          reason: isMember
            ? "Подписка на @Brainrot_GG подтверждена."
            : "Подпишись на @Brainrot_GG — кейс доступен только подписчикам.",
          checkAvailable: true,
        };
      } catch (membershipError) {
        console.warn("BrainGG special-case channel membership check failed:", membershipError instanceof Error ? membershipError.message : membershipError);
        free = {
          allowed: false,
          reason: "Не удалось проверить подписку. Добавь бота BrainGG в администраторы канала @Brainrot_GG.",
          checkAvailable: false,
        };
      }
      // The BrainGG CASE uses verified successful top-ups during a rolling 7-day window.
      // Telegram Stars orders are credited by the payment webhook; brainrot deposits
      // count only after the admin completes the trade and the balance is credited.
      const depositSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [starsOrdersResult, brainrotDepositsResult] = await Promise.all([
        supabase.from("telegram_star_orders").select("gg_amount, created_at, status")
          .eq("telegram_id", telegramUser.id).in("status", ["paid", "completed", "succeeded"])
          .gte("created_at", depositSince),
        supabase.from("brainrot_deposit_requests").select("amount_gg, created_at, status")
          .eq("telegram_id", telegramUser.id).eq("status", "completed")
          .gte("created_at", depositSince),
      ]);
      if (starsOrdersResult.error || brainrotDepositsResult.error) {
        console.error("BrainGG CASE deposit history lookup failed:", starsOrdersResult.error?.message || brainrotDepositsResult.error?.message);
        throw new Error("Не удалось проверить историю пополнений для BrainGG CASE.");
      }
      const depositedGg = [
        ...(starsOrdersResult.data || []).map((row: any) => Number(row.gg_amount || 0)),
        ...(brainrotDepositsResult.data || []).map((row: any) => Number(row.amount_gg || 0)),
      ].reduce((sum: number, amount: number) => sum + (Number.isFinite(amount) && amount > 0 ? amount : 0), 0);
      const deposit = {
        allowed: depositedGg >= 60,
        depositedGg: Math.round(depositedGg * 100) / 100,
        requiredGg: 60,
        windowDays: 7,
        reason: depositedGg >= 60
          ? `За последние 7 дней пополнено ${depositedGg.toLocaleString("ru-RU")} GG — условие выполнено.`
          : `За последние 7 дней пополнено ${depositedGg.toLocaleString("ru-RU")} из 60 GG. Пополни ещё ${(60 - depositedGg).toLocaleString("ru-RU")} GG.`,
      };

      // Cooldowns live in their own server-only table. They are deliberately
      // independent from `players`, so profile updates and case-opening RPCs
      // cannot accidentally clear or overwrite the lock.
      const { data: cooldownRows, error: cooldownError } = await supabase
        .from("special_case_cooldowns")
        .select("case_type, opened_at")
        .eq("telegram_id", telegramUser.id);
      if (cooldownError) throw cooldownError;

      const nickOpenedAt = cooldownRows?.find((row: any) => row.case_type === "nick")?.opened_at;
      const freeOpenedAt = cooldownRows?.find((row: any) => row.case_type === "free")?.opened_at;
      const depositOpenedAt = cooldownRows?.find((row: any) => row.case_type === "deposit")?.opened_at;

      const getCooldown = (openedAt: unknown, durationMs = 12 * 60 * 60 * 1000) => {
        const openedAtMs = Date.parse(String(openedAt || ""));
        if (!Number.isFinite(openedAtMs)) {
          return { cooldownUntil: null, remainingSeconds: 0 };
        }
        const untilMs = openedAtMs + durationMs;
        const remainingSeconds = Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
        return {
          cooldownUntil: remainingSeconds > 0 ? new Date(untilMs).toISOString() : null,
          remainingSeconds,
        };
      };

      return {
        nick: { ...nick, ...getCooldown(nickOpenedAt, SPECIAL_CASE_COOLDOWN_MS.nick) },
        free: { ...free, ...getCooldown(freeOpenedAt, SPECIAL_CASE_COOLDOWN_MS.free) },
        deposit: { ...deposit, ...getCooldown(depositOpenedAt, SPECIAL_CASE_COOLDOWN_MS.deposit) },
      };
    };

    // MINES: every outcome and balance change is server-side and atomic in SQL.
    if (body.action === "mines_get_active_game") {
      const { data, error } = await supabase.rpc("get_active_mines_game", { p_telegram_id: telegramUser.id });
      if (error) {
        console.error("Mines active game lookup failed:", error.message);
        return respond({ error: "Не удалось загрузить текущую игру. Проверь SQL-миграцию режима «Мины»." }, 500);
      }
      return respond({ success: true, game: data || null });
    }

    if (body.action === "mines_start_game") {
      const bet = Math.round(Number(body.bet) * 100) / 100;
      const mineCount = Number(body.mineCount);
      if (!Number.isFinite(bet) || bet < 1 || bet > 100000) return respond({ error: "Ставка должна быть от 1 до 100 000 GG." }, 400);
      if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) return respond({ error: "Выбери от 1 до 24 мин." }, 400);
      // Cryptographically secure Fisher-Yates shuffle; mine locations never come from the client.
      const random = crypto.getRandomValues(new Uint32Array(25));
      const cells = Array.from({ length: 25 }, (_, index) => index);
      for (let index = cells.length - 1; index > 0; index--) {
        const swapIndex = Math.floor((random[index] / 0x100000000) * (index + 1));
        [cells[index], cells[swapIndex]] = [cells[swapIndex], cells[index]];
      }
      const minePositions = cells.slice(0, mineCount).sort((a, b) => a - b);
      const { data, error } = await supabase.rpc("start_mines_game", {
        p_telegram_id: telegramUser.id, p_bet: bet, p_mine_count: mineCount, p_mine_positions: minePositions,
      });
      if (error) {
        console.warn("Mines start rejected:", error.message);
        if (String(error.message).includes("MINES_INSUFFICIENT_BALANCE")) return respond({ error: "Недостаточно GG для этой ставки." }, 400);
        if (String(error.message).includes("MINES_ACTIVE_GAME")) return respond({ error: "У тебя уже есть незавершённый раунд. Продолжи его на поле." }, 409);
        return respond({ error: "Не удалось начать раунд. Попробуй ещё раз." }, 400);
      }
      await recordGlobalActivity({ eventType: "mines_start", title: "Начал раунд в Минах", description: `Ставка ${bet} GG · ${mineCount} мин`, valueGg: bet, success: true });
      return respond({ success: true, game: data });
    }

    if (body.action === "mines_reveal_cell") {
      const gameId = String(body.gameId || "");
      const cell = Number(body.cell);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId) || !Number.isInteger(cell) || cell < 0 || cell > 24) return respond({ error: "Некорректная клетка или игровой раунд." }, 400);
      const { data, error } = await supabase.rpc("reveal_mines_cell", { p_telegram_id: telegramUser.id, p_game_id: gameId, p_cell: cell });
      if (error) {
        console.warn("Mines reveal rejected:", error.message);
        const message = String(error.message || "");
        if (message.includes("MINES_CELL_ALREADY_REVEALED")) return respond({ error: "Эта клетка уже открыта." }, 409);
        if (message.includes("MINES_GAME_NOT_ACTIVE")) return respond({ error: "Этот раунд уже завершён." }, 409);
        if (message.includes("MINES_GAME_NOT_FOUND")) return respond({ error: "Раунд не найден." }, 404);
        return respond({ error: "Не удалось открыть клетку." }, 400);
      }
      if (data?.status === "lost") await recordGlobalActivity({ eventType: "mines_loss", title: "Попал на мину", description: `Раунд завершён · ставка ${data.bet} GG`, valueGg: data.bet, success: false });
      return respond({ success: true, game: data });
    }

    if (body.action === "mines_cashout") {
      const gameId = String(body.gameId || "");
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(gameId)) return respond({ error: "Некорректный игровой раунд." }, 400);
      const { data, error } = await supabase.rpc("cashout_mines_game", { p_telegram_id: telegramUser.id, p_game_id: gameId });
      if (error) {
        console.warn("Mines cashout rejected:", error.message);
        const message = String(error.message || "");
        if (message.includes("MINES_NO_SAFE_CELLS")) return respond({ error: "Открой хотя бы одну безопасную клетку, чтобы забрать выигрыш." }, 400);
        if (message.includes("MINES_GAME_NOT_ACTIVE")) return respond({ error: "Этот раунд уже завершён." }, 409);
        if (message.includes("MINES_GAME_NOT_FOUND")) return respond({ error: "Раунд не найден." }, 404);
        return respond({ error: "Не удалось забрать выигрыш." }, 400);
      }
      await recordGlobalActivity({ eventType: "mines_cashout", title: "Забрал выигрыш в Минах", description: `Выигрыш ${data.payout} GG · ${data.safeCount} безопасных клеток`, valueGg: Number(data.payout || 0), success: true });
      return respond({ success: true, game: data });
    }

    if (body.action === "get_global_state") {
      try {
        const event = await getActiveEvent();
        return respond({ success: true, event });
      } catch (error) {
        console.error("Global state loading failed:", error?.message || error);
        return respond({ error: "Глобальные события пока не настроены. Примени новую SQL-миграцию." }, 503);
      }
    }

    if (body.action === "admin_set_event") {
      if (!isOwner) return respond({ error: "Запуск и управление ивентами доступны только владельцу BrainGG." }, 403);
      const requestedEvent = body.eventName == null || body.eventName === ""
        ? null
        : String(body.eventName).trim();
      const allowedEvents = ["tacos", "lucky", "strawberry", "red_fever", "gold_rush", "case_sale", "power_upgrade", "jackpot_hunt", "night_shift"];
      if (requestedEvent && !allowedEvents.includes(requestedEvent)) {
        return respond({ error: "Неизвестный ивент." }, 400);
      }
      try {
        const currentEvent = await getActiveEvent();
        const shouldStop = !requestedEvent || currentEvent?.event_name === requestedEvent;
        const now = new Date();
        const update = shouldStop
          ? { event_name: null, event_started_at: null, event_ends_at: null, updated_at: now.toISOString() }
          : { event_name: requestedEvent, event_started_at: now.toISOString(), event_ends_at: new Date(now.getTime() + 179000).toISOString(), updated_at: now.toISOString() };
        const { data, error } = await supabase.from("game_global_state")
          .update(update).eq("id", 1)
          .select("id, event_name, event_started_at, event_ends_at, updated_at").single();
        if (error) throw error;
        if (!shouldStop && currentEvent?.event_name) {
          await recordGlobalActivity({
            eventType: "event_ended",
            title: "Глобальное событие заменено",
            description: `Событие ${currentEvent.event_name} завершено запуском нового события.`,
            success: true,
          });
        }
        await recordGlobalActivity({
          eventType: shouldStop ? "event_ended" : "event_started",
          title: shouldStop ? "Глобальное событие завершено" : "Запущено глобальное событие",
          description: shouldStop ? `Событие ${currentEvent?.event_name || requestedEvent || "BrainGG"} завершено для всех игроков.` : `Событие ${requestedEvent} началось одновременно для всего BrainGG.`,
          success: true,
        });
        return respond({ success: true, event: data?.event_name ? data : null, stopped: shouldStop });
      } catch (error) {
        console.error("Admin event update failed:", error?.message || error);
        return respond({ error: "Не удалось изменить глобальный ивент. Проверь SQL-миграцию." }, 500);
      }
    }

    if (body.action === "admin_send_global_message") {
      if (!isOwner) return respond({ error: "Глобальные сообщения доступны только владельцу BrainGG." }, 403);
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!message || message.length > 500) return respond({ error: "Сообщение должно содержать от 1 до 500 символов." }, 400);
      try {
        const recentSince = new Date(Date.now() - 2500).toISOString();
        const { data: recent } = await supabase.from("game_global_messages")
          .select("id").gte("created_at", recentSince).limit(1);
        if (recent?.length) return respond({ error: "Подожди пару секунд перед следующим сообщением." }, 429);
        const { data, error } = await supabase.from("game_global_messages")
          .insert({ message })
          .select("id, message, created_at").single();
        if (error) throw error;
        await supabase.from("game_global_messages")
          .delete().lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
        await recordGlobalActivity({ eventType: "global_message", title: "Глобальное объявление BrainGG", description: message });
        return respond({ success: true, message: data });
      } catch (error) {
        console.error("Global message send failed:", error?.message || error);
        return respond({ error: "Не удалось отправить глобальное сообщение. Проверь SQL-миграцию." }, 500);
      }
    }

    // PROMO CODES: only the verified owner may create, inspect or deactivate codes.
    if (body.action === "admin_create_promo_code") {
      if (!isOwner) return respond({ error: "Создавать промокоды может только владелец BrainGG." }, 403);

      const code = String(body.code ?? "").trim().toUpperCase();
      const rewardType = String(body.rewardType ?? "").trim();
      const rewardAmount = Number(body.rewardAmount);
      const maxUsesRaw = body.maxUses == null || body.maxUses === "" ? null : Number(body.maxUses);
      const allowedRewardTypes = ["coins", "cases", "brainrot"];

      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
        return respond({ error: "Промокод должен содержать 3–24 символа: латинские буквы, цифры, дефис или подчёркивание." }, 400);
      }
      if (!allowedRewardTypes.includes(rewardType)) return respond({ error: "Неизвестный тип награды." }, 400);
      if (!Number.isSafeInteger(rewardAmount) || rewardAmount < 1 || rewardAmount > (rewardType === "brainrot" ? 1 : 1000000)) {
        return respond({ error: rewardType === "brainrot" ? "Для награды брейнротом количество должно быть равно 1." : "Количество награды должно быть от 1 до 1 000 000." }, 400);
      }
      if (maxUsesRaw !== null && (!Number.isSafeInteger(maxUsesRaw) || maxUsesRaw < 1 || maxUsesRaw > 1000000)) {
        return respond({ error: "Лимит активаций должен быть от 1 до 1 000 000 или оставь поле пустым." }, 400);
      }

      let caseName: string | null = null;
      let itemName: string | null = null;
      if (rewardType === "cases") {
        const raw = String(body.caseName ?? "").trim();
        caseName = ALLOWED_CASES.find((name) => name.toLowerCase() === raw.toLowerCase()) ?? null;
        if (!caseName) return respond({ error: "Выбери корректный кейс для награды." }, 400);
      }
      if (rewardType === "brainrot") {
        itemName = String(body.itemName ?? "").trim();
        if (!itemName || itemName.length > 120) return respond({ error: "Выбери брейнрота для награды." }, 400);
        const { data: reward, error: rewardError } = await supabase.from("case_rewards")
          .select("item_name").eq("item_name", itemName).gt("chance", 0).limit(1).maybeSingle();
        if (rewardError || !reward) return respond({ error: "Такого брейнрота нет в доступном пуле наград." }, 400);
      }

      let expiresAt: string | null = null;
      if (body.expiresAt != null && String(body.expiresAt).trim()) {
        const timestamp = Date.parse(String(body.expiresAt));
        if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return respond({ error: "Срок действия должен быть датой в будущем." }, 400);
        expiresAt = new Date(timestamp).toISOString();
      }

      const { data: promoCode, error: insertError } = await supabase.from("promo_codes").insert({
        code, reward_type: rewardType, reward_amount: rewardAmount, case_name: caseName, item_name: itemName,
        max_uses: maxUsesRaw, expires_at: expiresAt, created_by: telegramUser.id, active: true,
      }).select("id, code, reward_type, reward_amount, case_name, item_name, max_uses, uses_count, expires_at, active, created_at").single();

      if (insertError) {
        console.error("Promo code creation failed:", insertError.message);
        if (insertError.code === "23505") return respond({ error: "Такой промокод уже существует. Придумай другой." }, 409);
        return respond({ error: "Не удалось создать промокод. Проверь SQL-миграцию." }, 500);
      }
      return respond({ success: true, promoCode });
    }

    if (body.action === "admin_list_promo_codes") {
      if (!isOwner) return respond({ error: "Просматривать промокоды может только владелец BrainGG." }, 403);
      const { data: promoCodes, error } = await supabase.from("promo_codes")
        .select("id, code, reward_type, reward_amount, case_name, item_name, max_uses, uses_count, expires_at, active, created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) {
        console.error("Promo code list failed:", error.message);
        return respond({ error: "Не удалось загрузить промокоды. Проверь SQL-миграцию." }, 500);
      }
      return respond({ success: true, promoCodes: promoCodes ?? [] });
    }

    if (body.action === "admin_deactivate_promo_code") {
      if (!isOwner) return respond({ error: "Управлять промокодами может только владелец BrainGG." }, 403);
      const promoId = String(body.promoId ?? "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(promoId)) {
        return respond({ error: "Некорректный промокод." }, 400);
      }
      const { data: promoCode, error } = await supabase.from("promo_codes")
        .update({ active: false }).eq("id", promoId).select("id, code, active").maybeSingle();
      if (error) {
        console.error("Promo code deactivation failed:", error.message);
        return respond({ error: "Не удалось отключить промокод." }, 500);
      }
      if (!promoCode) return respond({ error: "Промокод не найден." }, 404);
      return respond({ success: true, promoCode });
    }

    if (body.action === "redeem_promo_code") {
      const code = String(body.code ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,24}$/.test(code)) return respond({ error: "Введи корректный промокод длиной 3–24 символа." }, 400);
      const { data: result, error } = await supabase.rpc("redeem_promo_code", {
        p_telegram_id: telegramUser.id, p_code: code,
      });
      if (error) {
        console.warn("Promo code redemption rejected:", error.message);
        const message = String(error.message || "");
        if (message.includes("PROMO_ALREADY_USED")) return respond({ error: "Ты уже активировал этот промокод." }, 409);
        if (message.includes("PROMO_EXPIRED")) return respond({ error: "Срок действия этого промокода закончился." }, 400);
        if (message.includes("PROMO_EXHAUSTED")) return respond({ error: "Все активации этого промокода уже использованы." }, 400);
        if (message.includes("PROMO_INVALID")) return respond({ error: "Промокод не найден или больше не активен." }, 404);
        if (message.includes("PROMO_REWARD_INVALID")) return respond({ error: "Награда этого промокода больше недоступна. Обратись к владельцу." }, 400);
        return respond({ error: "Не удалось активировать промокод. Попробуй ещё раз." }, 400);
      }
      let credits = { free_case_credits: [], free_cases_total: Number(result?.free_cases_total || 0) };
      try { credits = await getFreeCaseCredits(supabase, telegramUser.id); }
      catch (creditError) { console.warn("Promo redemption credits refresh failed:", creditError?.message || creditError); }
      await recordGlobalActivity({ eventType: "promo_redeemed", title: "Активировал промокод", description: "Игрок получил бонус BrainGG за промокод.", valueGg: Number(result?.reward_gg || 0), success: true });
      return respond({ success: true, result: { ...(result || {}), ...credits } });
    }

    // Create a Telegram Stars invoice. The client never credits its own balance.
    if (body.action === "create_stars_invoice") {
      const stars = Number(body.stars);
      if (!Number.isSafeInteger(stars) || stars < 25 || stars > 10000) {
        return respond({ error: "Количество Stars должно быть от 25 до 10000" }, 400);
      }
      const orderId = crypto.randomUUID();
      const gg = Math.round(stars * 1.25 * 100) / 100;
      const { error: orderError } = await supabase.from("telegram_star_orders").insert({
        id: orderId, telegram_id: telegramUser.id, stars, gg_amount: gg, status: "pending",
      });
      if (orderError) {
        console.error("Stars order creation failed:", orderError.message);
        return respond({ error: "Не удалось создать заказ на оплату" }, 500);
      }
      const invoiceResponse = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Пополнение BrainGG на ${gg} GG`,
          description: `Покупка ${gg} игровых монет BrainGG за ${stars} Telegram Stars`,
          payload: orderId, currency: "XTR", provider_token: "",
          prices: [{ label: `${gg} GG`, amount: stars }],
        }),
      });
      const invoice = await invoiceResponse.json();
      if (!invoice.ok || !invoice.result) {
        await supabase.from("telegram_star_orders").update({ status: "failed" }).eq("id", orderId);
        console.error("Telegram invoice creation failed:", invoice.description);
        return respond({ error: "Telegram не смог создать счёт. Попробуй позже." }, 502);
      }
      return respond({ success: true, orderId, invoiceUrl: invoice.result, stars, gg });
    }

    if (body.action === "check_stars_payment") {
      const orderId = String(body.orderId || "");
      const { data: order, error: orderError } = await supabase.from("telegram_star_orders")
        .select("id, status, stars, gg_amount").eq("id", orderId)
        .eq("telegram_id", telegramUser.id).maybeSingle();
      if (orderError || !order) return respond({ error: "Заказ не найден" }, 404);
      const { data: currentPlayer } = await supabase.from("players").select("balance")
        .eq("telegram_id", telegramUser.id).maybeSingle();
      return respond({ success: true, status: order.status, balance: currentPlayer?.balance ?? null,
        stars: order.stars, gg: Number(order.gg_amount) });
    }

    // BRAINROT TRADE DEPOSITS. The client never chooses the payout amount:
    // the database reads configured base prices and applies mutation/trait factors.
    if (body.action === "get_brainrot_deposit_catalog") {
      const [itemsResult, mutationsResult, traitsResult] = await Promise.all([
        supabase.from("brainrot_deposit_catalog").select("item_key, display_name, image_key, base_value_gg, enabled, sort_order").eq("enabled", true).order("sort_order"),
        supabase.from("brainrot_deposit_mutations").select("mutation_key, label, multiplier, display_value, sort_order").eq("enabled", true).order("sort_order"),
        supabase.from("brainrot_deposit_traits").select("trait_key, label, multiplier, display_value, effect_note, sort_order, enabled").eq("enabled", true).not("multiplier", "is", null).order("sort_order"),
      ]);
      const failure = itemsResult.error || mutationsResult.error || traitsResult.error;
      if (failure) {
        console.error("Brainrot deposit catalog unavailable:", failure.message);
        return respond({ error: "Каталог пополнения пока не настроен. Администратор должен применить SQL-миграцию." }, 503);
      }
      return respond({ success: true, items: itemsResult.data || [], mutations: mutationsResult.data || [], traits: traitsResult.data || [] });
    }

    if (body.action === "create_brainrot_deposit_request") {
      const robloxUsername = String(body.robloxUsername || "").trim().replace(/^@/, "");
      const brainrotKey = String(body.brainrotKey || "").trim();
      const mutationKey = String(body.mutationKey || "normal").trim();
      // Players cannot self-assign traits. The admin verifies actual traits from the trade later.
      const traitKeys: string[] = [];
      if (!/^[A-Za-z0-9_]{3,20}$/.test(robloxUsername)) return respond({ error: "Укажи корректный Roblox @username (3–20 символов, без отображаемого имени)." }, 400);
      if (!brainrotKey || brainrotKey.length > 80 || !mutationKey || mutationKey.length > 40) return respond({ error: "Некорректные данные заявки." }, 400);
      const { data: created, error: createError } = await supabase.rpc("create_brainrot_deposit_request", {
        p_telegram_id: telegramUser.id,
        p_roblox_username: robloxUsername,
        p_brainrot_key: brainrotKey,
        p_mutation_key: mutationKey,
        p_trait_keys: traitKeys,
      });
      if (createError) {
        const message = String(createError.message || "");
        if (message.includes("DEPOSIT_ALREADY_ACTIVE")) return respond({ error: "У тебя уже есть активная заявка. Сначала заверши её или дождись отказа." }, 409);
        if (message.includes("DEPOSIT_ITEM_PRICE_NOT_SET")) return respond({ error: "Для этого брейнрота администратор ещё не установил базовую цену." }, 400);
        if (message.includes("INVALID_ROBLOX_USERNAME")) return respond({ error: "Укажи именно Roblox @username, а не отображаемое имя." }, 400);
        if (message.includes("DEPOSIT_TRAIT_NOT_CONFIGURED")) return respond({ error: "Один из выбранных traits пока не настроен." }, 400);
        console.error("Brainrot deposit request creation failed:", createError.message);
        return respond({ error: "Не удалось создать заявку. Проверь выбранный предмет и попробуй ещё раз." }, 400);
      }
      const requestId = created?.id;
      const { data: requestRow, error: requestReadError } = await supabase.from("brainrot_deposit_requests")
        .select("*, brainrot_deposit_catalog(image_key)").eq("id", requestId).single();
      if (requestReadError || !requestRow) return respond({ error: "Заявка создана, но не удалось загрузить её карточку. Обнови статус." }, 500);
      const request = { ...requestRow, image_key: requestRow.brainrot_deposit_catalog?.image_key || brainrotKey };
      await sendPlayerTelegramMessage(telegramUser.id,
        `BrainGG: заявка на пополнение создана.
Брейнрот: ${request.brainrot_name}
Roblox: @${request.roblox_username}
Предварительно к начислению: ${Number(request.amount_gg).toLocaleString("ru-RU")} GG
Номер очереди: #${request.queue_number}. Дождись сообщения с назначенным аккаунтом хранения — не отправляй трейд заранее.`);
      return respond({ success: true, request, queue_position: created?.queue_position || null });
    }

    if (body.action === "get_my_brainrot_deposit_requests") {
      const { data: requests, error: requestsError } = await supabase.from("brainrot_deposit_requests")
        .select("*, brainrot_deposit_catalog(image_key)").eq("telegram_id", telegramUser.id)
        .order("created_at", { ascending: false }).limit(10);
      if (requestsError) {
        console.error("Player deposit requests loading failed:", requestsError.message);
        return respond({ error: "Не удалось загрузить статус пополнения. Примени SQL-миграцию." }, 503);
      }
      const { data: traitRows } = await supabase.from("brainrot_deposit_traits").select("trait_key, label");
      const traitLabels = new Map((traitRows || []).map((trait: any) => [trait.trait_key, trait.label]));
      const mapped = await Promise.all((requests || []).map(async (row: any) => {
        let queuePosition: number | null = null;
        if (["queued", "waiting_trade", "trade_received"].includes(row.status)) {
          const { count } = await supabase.from("brainrot_deposit_requests").select("id", { count: "exact", head: true })
            .in("status", ["queued", "waiting_trade", "trade_received"]).lt("queue_number", row.queue_number);
          queuePosition = Number(count || 0) + 1;
        }
        return {
          ...row,
          image_key: row.brainrot_deposit_catalog?.image_key || row.brainrot_key,
          trait_labels: (row.trait_keys || []).map((key: string) => traitLabels.get(key) || key),
          queue_position: queuePosition,
        };
      }));
      return respond({ success: true, requests: mapped });
    }

    if (body.action === "admin_get_brainrot_deposits") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const [itemsResult, requestsResult, traitsResult] = await Promise.all([
        supabase.from("brainrot_deposit_catalog").select("item_key, display_name, image_key, base_value_gg, enabled, sort_order").order("sort_order"),
        supabase.from("brainrot_deposit_requests").select("*, brainrot_deposit_catalog(image_key)")
          .in("status", ["queued", "waiting_trade", "trade_received"]).order("queue_number", { ascending: true }).limit(100),
        supabase.from("brainrot_deposit_traits").select("trait_key, label, multiplier, display_value, effect_note, enabled, sort_order").order("sort_order"),
      ]);
      const failure = itemsResult.error || requestsResult.error || traitsResult.error;
      if (failure) return respond({ error: "Не удалось загрузить очередь пополнений. Проверь SQL-миграцию." }, 503);
      const traitLabels = new Map((traitsResult.data || []).map((trait: any) => [trait.trait_key, trait.label]));
      const requests = (requestsResult.data || []).map((row: any) => ({
        ...row,
        image_key: row.brainrot_deposit_catalog?.image_key || row.brainrot_key,
        trait_labels: (row.trait_keys || []).map((key: string) => traitLabels.get(key) || key),
      }));
      return respond({ success: true, items: itemsResult.data || [], traits: traitsResult.data || [], requests });
    }

    if (body.action === "admin_set_brainrot_deposit_price") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const itemKey = String(body.itemKey || "").trim();
      const baseValueGg = Number(body.baseValueGg);
      if (!itemKey || !Number.isFinite(baseValueGg) || baseValueGg < 0 || baseValueGg > 100000000) return respond({ error: "Некорректная базовая цена." }, 400);
      const { data, error } = await supabase.rpc("admin_set_brainrot_deposit_price", { p_item_key: itemKey, p_base_value_gg: baseValueGg });
      if (error) return respond({ error: "Не удалось сохранить цену. Проверь, что SQL-миграция применена." }, 400);
      return respond({ success: true, item: data?.item || null });
    }

    if (body.action === "admin_assign_next_brainrot_deposit") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const { data, error } = await supabase.rpc("admin_assign_next_brainrot_deposit", { p_admin_telegram_id: telegramUser.id });
      if (error) return respond({ error: "Не удалось назначить следующую заявку. Проверь SQL-миграцию." }, 400);
      if (data?.empty || !data?.request) return respond({ success: true, empty: true });
      const request = data.request;
      await sendPlayerTelegramMessage(request.telegram_id,
        `BrainGG: твоя очередь!
Отправь запрос на трейд аккаунту @${request.assigned_storage_account} в Steal a Brainrot.
Предмет: ${request.brainrot_name}
После принятия трейда положи предмет, нажми Ready и дождись дальнейшей инструкции. Не нажимай Accept раньше времени.`);
      return respond({ success: true, empty: false, request });
    }

    if (body.action === "admin_mark_brainrot_deposit_received") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const requestId = String(body.requestId || "");
      const traitKeys = Array.isArray(body.traitKeys)
        ? [...new Set(body.traitKeys.map((value: unknown) => String(value).trim()).filter(Boolean))]
        : [];
      if (!requestId || traitKeys.length > 40) return respond({ error: "Некорректные данные подтверждения трейда." }, 400);
      const { data, error } = await supabase.rpc("admin_mark_brainrot_deposit_received", {
        p_request_id: requestId,
        p_admin_telegram_id: telegramUser.id,
        p_trait_keys: traitKeys,
      });
      if (error) {
        console.error("Brainrot deposit trade verification failed:", error.message);
        return respond({ error: "Не удалось подтвердить предмет и traits. Проверь миграцию и выбранные traits." }, 400);
      }
      const request = data?.request;
      const verifiedTraits = traitKeys.length
        ? await supabase.from("brainrot_deposit_traits").select("label").in("trait_key", traitKeys)
        : { data: [] };
      const traitText = (verifiedTraits.data || []).map((row: any) => row.label).join(", ") || "без дополнительных traits";
      if (request?.telegram_id && !data?.duplicate) await sendPlayerTelegramMessage(request.telegram_id,
        `BrainGG: предмет ${request.brainrot_name} и его traits проверены.
Учтённые traits: ${traitText}.
Предварительная сумма пересчитана: ${Number(request.amount_gg || 0).toLocaleString("ru-RU")} GG.
Дождись, пока администратор нажмёт Ready, затем нажми Accept. После полного завершения трейда администратор подтвердит начисление.`);
      return respond({ success: true, request, amount_gg: Number(request?.amount_gg || 0), trait_labels: (verifiedTraits.data || []).map((row: any) => row.label) });
    }

    if (body.action === "admin_complete_brainrot_deposit") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const requestId = String(body.requestId || "");
      const { data, error } = await supabase.rpc("admin_complete_brainrot_deposit", { p_request_id: requestId, p_admin_telegram_id: telegramUser.id });
      if (error) return respond({ error: "Зачисление разрешено только после подтверждения получения предмета. Проверь статус трейда." }, 400);
      const request = data?.request;
      if (request?.telegram_id && !data?.duplicate) await sendPlayerTelegramMessage(request.telegram_id,
        `Пополнение удалось :)
Брейнрот: ${request.brainrot_name}
Начислено: +${Number(data.amount_gg || request.amount_gg || 0).toLocaleString("ru-RU")} GG
Новый баланс: ${Number(data.balance || 0).toLocaleString("ru-RU")} GG`);
      if (!data?.duplicate) await recordGlobalActivity({ eventType: "brainrot_deposit", title: "Игрок пополнил баланс брейнротом", description: `${request?.brainrot_name || "Брейнрот"} · +${Number(data.amount_gg || 0).toLocaleString("ru-RU")} GG`, valueGg: Number(data.amount_gg || 0), success: true });
      return respond({ success: true, amount_gg: Number(data.amount_gg || 0), balance: data.balance, request });
    }

    if (body.action === "admin_reject_brainrot_deposit") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const requestId = String(body.requestId || "");
      const reason = String(body.reason || "").trim().slice(0, 300);
      const { data, error } = await supabase.rpc("admin_reject_brainrot_deposit", { p_request_id: requestId, p_admin_telegram_id: telegramUser.id, p_reason: reason || null });
      if (error) return respond({ error: "Не удалось отклонить заявку. Возможно, обмен уже завершён." }, 400);
      const request = data?.request;
      if (request?.telegram_id && !data?.duplicate) await sendPlayerTelegramMessage(request.telegram_id,
        `Пополнение не удалось :(
${reason ? `Причина: ${reason}` : "Трейд отклонён или не завершён."}
Если считаешь, что это ошибка, свяжись с администрацией BrainGG.`);
      return respond({ success: true, request });
    }

    const recordProgress = async (action: string, amount = 1) => {
      const { error } = await supabase.rpc("record_player_action", {
        p_telegram_id: telegramUser.id,
        p_action: action,
        p_amount: amount,
      });
      if (error) console.error("Player progress update failed:", error.message);
    };

    const GAME_TASKS = [
      { id: "open_3", title: "Открой 3 кейса", description: "Попробуй удачу трижды", goal: 3, metric: "total_cases_opened", reward: 15, xp: 40 },
      { id: "open_10", title: "Открой 10 кейсов", description: "Стань ближе к редкой коллекции", goal: 10, metric: "total_cases_opened", reward: 35, xp: 100 },
      { id: "sell_1", title: "Продай предмет", description: "Освободи место в коллекции", goal: 1, metric: "total_sales", reward: 10, xp: 30 },
      { id: "upgrade_1", title: "Улучши предмет", description: "Попробуй улучшить брейнрота", goal: 1, metric: "total_upgrades", reward: 20, xp: 50 },
    ];

    // Игровой центр: публичная лента, прогресс, задания и рейтинг.
    if (body.action === "get_game_hub") {
      const { error: ensureProgressError } = await supabase.from("player_progress").upsert({ telegram_id: telegramUser.id }, { onConflict: "telegram_id", ignoreDuplicates: true });
      if (ensureProgressError) return respond({ error: "Не удалось инициализировать игровой профиль" }, 500);
      const { data: progress, error: progressError } = await supabase
        .from("player_progress")
        .select("xp, total_cases_opened, total_sales, total_upgrades, daily_streak, last_daily_claim")
        .eq("telegram_id", telegramUser.id).maybeSingle();
      if (progressError) return respond({ error: "Не удалось загрузить прогресс" }, 500);

      const { data: latestItems, error: dropsError } = await supabase
        .from("game_live_drops")
        .select("id, telegram_id, item_name, rarity, value_gg, case_name, mutation, created_at")
        .order("created_at", { ascending: false }).limit(25);
      if (dropsError) console.error("Live drops loading failed:", dropsError.message);
      const dropIds = [...new Set((latestItems || []).map((item: any) => item.telegram_id))];
      const { data: dropPlayers } = dropIds.length
        ? await supabase.from("players").select("telegram_id, username").in("telegram_id", dropIds)
        : { data: [] };
      const usernames = new Map((dropPlayers || []).map((p: any) => [String(p.telegram_id), p.username]));
      const liveDrops = (latestItems || []).map((item: any) => ({
        id: item.id, item_name: item.item_name, rarity: item.rarity, value_gg: Number(item.value_gg || 0),
        created_at: item.created_at, case_name: item.case_name, mutation: item.mutation || null,
        username: usernames.get(String(item.telegram_id)) || "Игрок",
      }));

      const { data: rankingRows, error: rankingError } = await supabase
        .from("player_progress")
        .select("telegram_id, xp, total_cases_opened, total_sales, total_upgrades")
        .order("xp", { ascending: false }).limit(50);
      if (rankingError) console.error("Leaderboard loading failed:", rankingError.message);
      const rankIds = (rankingRows || []).map((row: any) => row.telegram_id);
      const { data: rankPlayers } = rankIds.length
        ? await supabase.from("players").select("telegram_id, username, game_id").in("telegram_id", rankIds)
        : { data: [] };
      const rankMap = new Map((rankPlayers || []).map((p: any) => [String(p.telegram_id), p]));
      const leaderboard = (rankingRows || []).map((row: any) => {
        const p: any = rankMap.get(String(row.telegram_id)) || {};
        const xp = Number(row.xp || 0);
        return { username: p.username || "Игрок", game_id: p.username ? `@${p.username}` : null, xp, level: Math.floor(Math.sqrt(xp / 100)) + 1,
          total_cases_opened: Number(row.total_cases_opened || 0) };
      });

      const today = new Date().toISOString().slice(0, 10);
      const { data: dailyClaim } = await supabase.from("daily_reward_claims")
        .select("claim_date, streak_day, reward_gg").eq("telegram_id", telegramUser.id).eq("claim_date", today).maybeSingle();
      const { data: taskClaims } = await supabase.from("task_reward_claims")
        .select("task_id").eq("telegram_id", telegramUser.id).eq("claim_date", today);
      const xp = Number(progress?.xp || 0);
      const level = Math.floor(Math.sqrt(xp / 100)) + 1;
      const nextLevelXp = level * level * 100;
      const tasks = GAME_TASKS.map((task) => ({ ...task, progress: Number((progress as any)?.[task.metric] || 0), claimed: (taskClaims || []).some((c: any) => c.task_id === task.id) }));
      return respond({ success: true, progress: { ...(progress || {}), xp, level, next_level_xp: nextLevelXp },
        liveDrops, leaderboard, tasks, dailyClaimed: Boolean(dailyClaim), dailyClaim });
    }

    if (body.action === "claim_daily_reward") {
      const { data, error } = await supabase.rpc("claim_daily_reward", { p_telegram_id: telegramUser.id });
      if (error) { console.error("Daily reward claim failed:", error.message); return respond({ error: "Не удалось получить ежедневную награду" }, 400); }
      const rewardResult = typeof data === "string" ? JSON.parse(data) : data;
      const { data: player } = await supabase.from("players").select("balance").eq("telegram_id", telegramUser.id).maybeSingle();
      if (rewardResult?.success) await recordGlobalActivity({ eventType: "daily_reward", title: "Забрал ежедневную награду", description: `Серия: ${Number(rewardResult.streak || 1)} дн.`, valueGg: Number(rewardResult.reward_gg || 0), success: true });
      return respond({ success: true, result: rewardResult, balance: player?.balance });
    }

    if (body.action === "claim_task_reward") {
      const taskId = String(body.taskId || "");
      const task = GAME_TASKS.find((entry) => entry.id === taskId);
      if (!task) return respond({ error: "Неизвестное задание" }, 400);
      const { data, error } = await supabase.rpc("claim_task_reward", { p_telegram_id: telegramUser.id, p_task_id: taskId });
      if (error) { console.error("Task reward claim failed:", error.message); return respond({ error: "Не удалось получить награду" }, 400); }
      const taskResult = typeof data === "string" ? JSON.parse(data) : data;
      const { data: player } = await supabase.from("players").select("balance").eq("telegram_id", telegramUser.id).maybeSingle();
      if (taskResult?.success) await recordGlobalActivity({ eventType: "task_reward", title: "Завершил игровое задание", description: `${task.title} · +${Number(taskResult.reward_gg || 0)} GG`, valueGg: Number(taskResult.reward_gg || 0), success: true });
      return respond({ success: true, result: taskResult, balance: player?.balance });
    }

    if (body.action === "get_quiz_status") {
      const { data, error } = await supabase.from("brainrot_quiz_attempts").select("is_correct").eq("telegram_id", telegramUser.id).eq("attempt_date", new Date().toISOString().slice(0, 10));
      if (error) return respond({ error: "Викторина пока не настроена. Примени SQL-миграцию BrainGG Quiz." }, 503);
      const rows = data || [];
      return respond({ success: true, status: { used: rows.length, remaining: Math.max(0, 3 - rows.length), correct: rows.filter((row: any) => row.is_correct).length } });
    }

    if (body.action === "get_quiz_question") {
      const { data: usedRows, error } = await supabase.from("brainrot_quiz_attempts").select("question_id, is_correct").eq("telegram_id", telegramUser.id).eq("attempt_date", new Date().toISOString().slice(0, 10));
      if (error) return respond({ error: "Викторина пока не настроена. Примени SQL-миграцию BrainGG Quiz." }, 503);
      const used = new Set((usedRows || []).map((row: any) => row.question_id));
      const remaining = QUIZ_QUESTIONS.filter((question) => !used.has(question.id));
      const status = { used: (usedRows || []).length, remaining: Math.max(0, 3 - (usedRows || []).length), correct: (usedRows || []).filter((row: any) => row.is_correct).length };
      if (status.remaining <= 0 || !remaining.length) return respond({ success: true, question: null, status });
      const question = remaining[Math.floor(Math.random() * remaining.length)];
      return respond({ success: true, status, question: { id: question.id, question: question.question, options: question.options } });
    }

    if (body.action === "submit_quiz_answer") {
      const questionId = String(body.questionId || "");
      const optionIndex = Number(body.optionIndex);
      const question = QUIZ_QUESTIONS.find((item) => item.id === questionId);
      if (!question || !Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= question.options.length) return respond({ error: "Некорректный ответ" }, 400);
      const correct = optionIndex === question.answer;
      const { data, error } = await supabase.rpc("submit_brainrot_quiz_answer", { p_telegram_id: telegramUser.id, p_question_id: question.id, p_is_correct: correct });
      if (error) { console.error("Quiz answer submit failed:", error.message); return respond({ error: error.message.includes("QUIZ_DAILY_LIMIT") ? "Все три попытки на сегодня использованы." : "Не удалось сохранить ответ. Проверь SQL-миграцию викторины." }, 400); }
      const result = typeof data === "string" ? JSON.parse(data) : data;
      const { data: player } = await supabase.from("players").select("balance").eq("telegram_id", telegramUser.id).maybeSingle();
      await recordGlobalActivity({ eventType: correct ? "quiz_correct" : "quiz_answered", title: correct ? "Правильно ответил в викторине" : "Участвовал в викторине", description: correct ? "Верный ответ · +5 GG" : "Ответил на вопрос BrainGG.", valueGg: correct ? 5 : 0, success: correct });
      return respond({ success: true, correct, reward_gg: correct ? 5 : 0, correct_answer: question.options[question.answer], correct_index: question.answer, explanation: question.explanation, balance: player?.balance, status: { used: result.used, remaining: Math.max(0, 3 - Number(result.used || 0)), correct: result.correct_count } });
    }

    if (body.action === "admin_adjust_xp") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const gameId = String(body.gameId || "").trim();
      const amount = Number(body.amount);
      if (!gameId || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) return respond({ error: "Некорректное количество XP" }, 400);
      const { data: targetPlayer, error: targetError } = await findPlayerByPublicGameId(supabase, gameId, "telegram_id, username");
      if (targetError || !targetPlayer) return respond({ error: "Игрок не найден" }, 404);
      const { data: xp, error } = await supabase.rpc("admin_adjust_player_xp", { p_player_telegram_id: targetPlayer.telegram_id, p_amount: amount });
      if (error) { console.error("Admin XP adjustment failed:", error.message); return respond({ error: "Не удалось начислить XP. Применена ли миграция Season 2?" }, 400); }
      await recordGlobalActivity({ eventType: "admin_reward", title: "Игрок получил XP от администрации", description: `${targetPlayer.username ? `@${targetPlayer.username}` : "Игрок"} · +${amount} XP`, username: targetPlayer.username, success: true });
      return respond({ success: true, xp });
    }

    if (body.action === "admin_get_game_stats") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const [playersCount, inventoryCount, progressCount] = await Promise.all([
        supabase.from("players").select("telegram_id", { count: "exact", head: true }),
        supabase.from("inventory").select("id", { count: "exact", head: true }),
        supabase.from("player_progress").select("telegram_id", { count: "exact", head: true }),
      ]);
      return respond({ success: true, stats: { players: playersCount.count || 0, inventory_items: inventoryCount.count || 0, active_profiles: progressCount.count || 0 } });
    }

    // АДМИН: ПОИСК ИГРОКА
    if (body.action === "admin_find_player") {
      if (!isAdmin) {
        return respond({ error: "Доступ запрещён" }, 403);
      }

      const gameId = String(body.gameId ?? "").trim();

      if (!gameId || gameId.length > 100) {
        return respond({ error: "Укажи Telegram username игрока" }, 400);
      }

      const { data: player, error } = await findPlayerByPublicGameId(
        supabase,
        gameId,
        "telegram_id, game_id, username, balance, free_cases",
      );

      if (error) {
        console.error("Admin player lookup failed:", error.message);
        return respond({ error: "Не удалось найти игрока" }, 500);
      }

      if (!player) {
        return respond(
          { error: "Игрок с таким Telegram username не найден" },
          404,
        );
      }

      const { data: inventory, error: inventoryError } = await supabase
        .from("inventory")
        .select("id, item_name, rarity, value_gg, mutation, created_at")
        .eq("telegram_id", player.telegram_id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (inventoryError) {
        console.error(
          "Admin inventory lookup failed:",
          inventoryError.message,
        );
        return respond(
          { error: "Не удалось загрузить инвентарь игрока" },
          500,
        );
      }

      let credits;

      try {
        credits = await getFreeCaseCredits(
          supabase,
          player.telegram_id,
        );
      } catch {
        return respond(
          { error: "Не удалось загрузить бесплатные кейсы игрока" },
          500,
        );
      }

      const { data: playerProgress } = await supabase.from("player_progress").select("xp, total_cases_opened, total_sales, total_upgrades, daily_streak").eq("telegram_id", player.telegram_id).maybeSingle();

      return respond({
        success: true,
        player: {
          ...player,
          game_id: player.username ? `@${player.username}` : String(player.game_id || ""),
          ...credits,
          progress: playerProgress || null,
        },
        inventory: inventory ?? [],
        freeCaseCredits: credits.free_case_credits,
      });
    }

    // АДМИН: ВЫДАЧА НАГРАД
    if (body.action === "admin_grant") {
      if (!isAdmin) {
        return respond({ error: "Доступ запрещён" }, 403);
      }

      const gameId = String(body.gameId ?? "").trim();
      const grantType = String(body.grantType ?? "").trim();
      const amount = Number(body.amount);

      const itemName =
        typeof body.itemName === "string"
          ? body.itemName.trim()
          : "";

      const rawCaseName =
        typeof body.caseName === "string"
          ? body.caseName.trim()
          : "";

      const caseName = ALLOWED_CASES.find(
        (name) => name.toLowerCase() === rawCaseName.toLowerCase(),
      ) ?? "";

      if (!gameId || gameId.length > 100) {
        return respond({ error: "Укажи корректный Game ID" }, 400);
      }

      if (
        !Number.isSafeInteger(amount) ||
        amount < 1 ||
        amount > 1000000
      ) {
        return respond(
          { error: "Количество должно быть от 1 до 1 000 000" },
          400,
        );
      }

      if (!["coins", "cases", "brainrot"].includes(grantType)) {
        return respond({ error: "Неизвестный тип выдачи" }, 400);
      }

      if (grantType === "cases" && !caseName) {
        return respond(
          { error: "Выбери корректный тип кейса" },
          400,
        );
      }

      if (
        grantType === "brainrot" &&
        (!itemName || itemName.length > 120)
      ) {
        return respond({ error: "Выбери брейнрота" }, 400);
      }

      const { data: player, error: playerError } = await findPlayerByPublicGameId(
        supabase,
        gameId,
        "telegram_id, game_id, username",
      );

      if (playerError) {
        console.error(
          "Admin grant player lookup failed:",
          playerError.message,
        );
        return respond({ error: "Не удалось проверить игрока" }, 500);
      }

      if (!player) {
        return respond(
          { error: "Игрок с таким Game ID не найден" },
          404,
        );
      }

      // Бесплатные кейсы выдаются отдельной SQL-функцией.
      if (grantType === "cases") {
        const { data, error } = await supabase.rpc(
          "admin_grant_case_credits",
          {
            p_admin_telegram_id: telegramUser.id,
            p_player_telegram_id: player.telegram_id,
            p_game_id: String(player.game_id),
            p_case_name: caseName,
            p_amount: amount,
          },
        );

        if (error) {
          console.error("Free case grant failed:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
            caseName,
          });

          return respond(
            { error: "Не удалось выдать бесплатные кейсы" },
            400,
          );
        }

        // Возвращаем обновлённый остаток выданных кейсов.
        const credits = await getFreeCaseCredits(
          supabase,
          player.telegram_id,
        );
        await recordGlobalActivity({ eventType: "admin_reward", title: "Игрок получил кейсы от администрации", description: `${player.username ? `@${player.username}` : "Игрок"} · ${amount} × ${caseName}`, username: player.username, caseName, success: true });

        return respond({
          success: true,
          result: data,
          ...credits,
        });
      }

      // Монеты и брейнроты.
      const rpcArgs = {
        p_admin_telegram_id: telegramUser.id,
        p_player_telegram_id: player.telegram_id,
        p_action: grantType,
        p_amount: amount,
        p_item_name: grantType === "brainrot" ? itemName : null,
        p_case_name: null,
      };

      const { data, error } = await supabase.rpc(
        "admin_grant_player",
        rpcArgs,
      );

      if (error) {
        console.error("Admin grant failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });

        return respond(
          {
            error: error.message.includes("BRAINROT_NOT_FOUND")
              ? "Такого брейнрота нет в списке наград"
              : "Не удалось выполнить выдачу",
          },
          400,
        );
      }

      await recordGlobalActivity({
        eventType: "admin_reward",
        title: grantType === "coins" ? "Игрок получил GG от администрации" : "Игрок получил брейнрота от администрации",
        description: `${player.username ? `@${player.username}` : "Игрок"} · ${grantType === "coins" ? `${amount} GG` : itemName}`,
        username: player.username,
        itemName: grantType === "brainrot" ? itemName : null,
        valueGg: grantType === "coins" ? amount : null,
        success: true,
      });
      return respond({ success: true, result: data });
    }

    // АДМИН: ИСТОРИЯ ВЫДАЧ
    if (body.action === "admin_get_logs") {
      if (!isAdmin) {
        return respond({ error: "Доступ запрещён" }, 403);
      }

      const { data: logs, error } = await supabase
        .from("admin_grant_logs")
        .select(
          "id, admin_telegram_id, player_telegram_id, game_id, action, amount, item_name, case_name, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Admin logs loading failed:", error.message);
        return respond(
          { error: "Не удалось загрузить историю выдач" },
          500,
        );
      }

      const logPlayerIds = [...new Set((logs || []).map((log: any) => String(log.player_telegram_id || "")).filter(Boolean))];
      const { data: logPlayers } = logPlayerIds.length
        ? await supabase.from("players").select("telegram_id, username").in("telegram_id", logPlayerIds)
        : { data: [] };
      const logUsernames = new Map((logPlayers || []).map((entry: any) => [String(entry.telegram_id), entry.username]));
      const publicLogs = (logs || []).map((log: any) => ({
        ...log,
        game_id: logUsernames.get(String(log.player_telegram_id))
          ? `@${logUsernames.get(String(log.player_telegram_id))}`
          : log.game_id,
      }));
      return respond({ success: true, logs: publicLogs, isOwner });
    }

    // PERSONAL HISTORY: initData is verified above, so only the signed-in player's rows are returned.
    if (body.action === "get_player_history") {
      const { data: history, error } = await supabase
        .from("opening_history")
        .select("case_name, item_name, price, created_at")
        .eq("telegram_id", telegramUser.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        console.error("Player history loading failed:", error.message);
        return respond({ error: "Could not load player history" }, 503);
      }
      return respond({ success: true, history: history || [] });
    }

    // ИНВЕНТАРЬ
    if (body.action === "get_inventory") {
      const { data: items, error } = await supabase
        .from("inventory")
        .select("id, item_name, rarity, value_gg, mutation, created_at")
        .eq("telegram_id", telegramUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Inventory loading failed:", error.message);
        return respond({ error: "Could not load inventory" }, 500);
      }

      const uniqueItems = Array.from(
        new Map((items ?? []).map((item) => [`${item.item_name}:${item.mutation || "normal"}`, item])).values(),
      );
      return respond({ success: true, items: uniqueItems });
    }

    // ПРОДАЖА ПРЕДМЕТА
    if (body.action === "sell_item") {
      const inventoryId = Number(body.inventoryId);

      if (
        !Number.isSafeInteger(inventoryId) ||
        inventoryId <= 0
      ) {
        return respond({ error: "Invalid inventory item" }, 400);
      }

      const { data: soldItem } = await supabase.from("inventory")
        .select("item_name, rarity, value_gg, mutation")
        .eq("id", inventoryId).eq("telegram_id", telegramUser.id).maybeSingle();
      const { data, error } = await supabase.rpc(
        "sell_inventory_item_with_event",
        {
          p_telegram_id: telegramUser.id,
          p_inventory_id: inventoryId,
        },
      );

      if (error) {
        console.error("Item sale failed:", error.message);
        return respond({ error: error.message }, 400);
      }

      await recordProgress("sell_item", 1);
      const saleResult = typeof data === "string" ? JSON.parse(data) : data;
      const soldPrice = Number(saleResult?.sold_price ?? soldItem?.value_gg ?? 0);
      if (soldItem) await recordGlobalActivity({ eventType: "item_sold", title: "Продал брейнрота", description: `${soldItem.item_name} · ${soldPrice} GG${Number(saleResult?.event_multiplier || 1) > 1 ? " · GOLD RUSH ×2" : ""}`, itemName: soldItem.item_name, rarity: soldItem.rarity, valueGg: soldPrice, success: true });
      return respond({ success: true, result: saleResult });
    }

    // ЦЕЛИ АПГРЕЙДА
    if (body.action === "get_upgrade_targets") {
      const { data: items, error } = await supabase
        .from("case_rewards")
        .select("item_name, rarity, value_gg")
        .order("value_gg", { ascending: true });

      if (error) {
        console.error("Upgrade targets loading failed:", error.message);
        return respond(
          { error: "Could not load upgrade targets" },
          500,
        );
      }

      const uniqueTargets = new Map<string, any>();
      for (const item of items ?? []) {
        const key = String(item.item_name || "").trim();
        if (!key) continue;
        const existing = uniqueTargets.get(key);
        if (!existing || Number(item.value_gg || 0) > Number(existing.value_gg || 0)) {
          uniqueTargets.set(key, item);
        }
      }
      const targets = [...uniqueTargets.values()].sort((a, b) =>
        Number(a.value_gg || 0) - Number(b.value_gg || 0) || String(a.item_name).localeCompare(String(b.item_name), "ru"),
      );
      return respond({ success: true, items: targets });
    }

    if (body.action === "get_special_case_access") {
      const access = await getSpecialCaseAccess();
      return respond({ success: true, access });
    }

    if (body.action === "get_case_rewards") {
      const rawCaseName = typeof body.caseName === "string" ? body.caseName.trim() : "";
      const caseName = ALLOWED_CASES.find((name) => name.toLowerCase() === rawCaseName.toLowerCase());
      if (!caseName) return respond({ error: "Unknown case" }, 400);
      const { data: rewards, error } = await supabase.from("case_rewards")
        .select("item_name, rarity, value_gg, chance")
        .eq("case_name", caseName).gt("chance", 0)
        .order("value_gg", { ascending: true });
      if (error) {
        console.error("Case rewards loading failed:", error.message);
        return respond({ error: "Не удалось загрузить содержимое кейса" }, 500);
      }
      let event = null;
      try { event = await getActiveEvent(); } catch (eventError) {
        console.warn("Could not load event multiplier for case preview:", eventError?.message || eventError);
      }
      const weighted = (rewards || []).map((item: any) => {
        const rarity = String(item.rarity || "").toLowerCase();
        const nonCommon = !["обычный", "common"].includes(rarity);
        const jackpot = ["легендарный", "мифический", "ог", "legendary", "mythic", "og"].includes(rarity);
        const multiplier = event?.event_name === "lucky" && nonCommon ? 2
          : event?.event_name === "red_fever" && nonCommon ? 1.5
          : event?.event_name === "jackpot_hunt" && jackpot ? 3 : 1;
        return { ...item, effective_weight: Number(item.chance || 0) * multiplier, event_weight_multiplier: multiplier };
      });
      const totalWeight = weighted.reduce((sum: number, item: any) => sum + Number(item.effective_weight || 0), 0);
      const result = weighted.map((item: any) => ({
        ...item,
        drop_chance_percent: totalWeight > 0 ? Number(item.effective_weight) / totalWeight * 100 : 0,
      }));
      return respond({ success: true, caseName, items: result, eventName: event?.event_name || null, luckyBoost: event?.event_name === "lucky" });
    }

    // АПГРЕЙД
    if (body.action === "upgrade_item") {
      const inventoryId = Number(body.inventoryId);
      const targetItem = body.targetItem;

      if (
        !Number.isSafeInteger(inventoryId) ||
        inventoryId <= 0 ||
        typeof targetItem !== "string" ||
        !targetItem.trim()
      ) {
        return respond(
          { error: "Invalid upgrade parameters" },
          400,
        );
      }

      // The wrapper checks the event timestamp inside the same database transaction,
      // avoiding a race between the Edge Function's event read and the actual upgrade.
      const { data: upgradeSource } = await supabase.from("inventory")
        .select("item_name, rarity, value_gg")
        .eq("id", inventoryId).eq("telegram_id", telegramUser.id).maybeSingle();
      const { data, error } = await supabase.rpc(
        "upgrade_inventory_item_fair_v2",
        {
          p_telegram_id: telegramUser.id,
          p_inventory_id: inventoryId,
          p_target_item: targetItem.trim(),
        },
      );

      if (error) {
        console.error("Upgrade failed:", error.message);
        return respond({ error: error.message }, 400);
      }

      await recordProgress("upgrade_item", 1);
      const upgradeResult = typeof data === "string" ? JSON.parse(data) : data;
      const upgradeWon = Boolean(upgradeResult?.won);
      await recordGlobalActivity({
        eventType: upgradeWon ? "upgrade_won" : "upgrade_failed",
        title: upgradeWon ? "Успешный апгрейд" : "Попытка апгрейда",
        description: `${upgradeSource?.item_name || "Предмет"} → ${upgradeResult?.target_item || targetItem.trim()}`,
        itemName: upgradeResult?.target_item || targetItem.trim(),
        rarity: upgradeSource?.rarity || null,
        success: upgradeWon,
      });
      return respond({ success: true, result: upgradeResult });
    }

    // SPECIAL CASES: server-side Telegram eligibility + an atomic, independent
    // case-specific cooldown stored outside the players table.
    if (body.action === "open_special_case") {
      const specialCaseType = String(body.specialCaseType || "").trim() as keyof typeof SPECIAL_CASES;
      if (!Object.prototype.hasOwnProperty.call(SPECIAL_CASES, specialCaseType)) {
        return respond({ error: "Неизвестный специальный кейс." }, 400);
      }
      const specialCase = SPECIAL_CASES[specialCaseType];

      const access = await getSpecialCaseAccess();
      const requirement = access[specialCaseType];
      if (!requirement.allowed) return respond({ error: requirement.reason }, 403);
      if (Number(requirement.remainingSeconds || 0) > 0) {
        return respond({
          error: `Этот кейс уже открыт. Следующее бесплатное открытие будет доступно через ${formatSpecialCooldown(Number(requirement.remainingSeconds))}.`,
          cooldownUntil: requirement.cooldownUntil,
          remainingSeconds: requirement.remainingSeconds,
        }, 429);
      }

      // The UPDATE in this RPC is atomic. Two simultaneous requests for the same
      // player/case cannot both claim the opening; the other special case is independent.
      const { data: cooldownClaimData, error: cooldownClaimError } = await supabase.rpc(
        "claim_special_case_cooldown",
        { p_telegram_id: telegramUser.id, p_case_type: specialCaseType },
      );
      if (cooldownClaimError) {
        console.error("Special case cooldown claim failed:", cooldownClaimError.message);
        return respond({ error: "Таблица таймеров специальных кейсов не настроена. Выполни SQL из supabase/manual-sql/special-case-credits.sql и повтори попытку." }, 503);
      }
      const cooldownClaim = Array.isArray(cooldownClaimData) ? cooldownClaimData[0] : cooldownClaimData;
      const claimToken = cooldownClaim?.claim_token;
      if (!claimToken) {
        const latestAccess = await getSpecialCaseAccess();
        const latestRequirement = latestAccess[specialCaseType];
        return respond({
          error: "Кейс уже открыт или его открытие обрабатывается. Попробуй позже.",
          cooldownUntil: latestRequirement.cooldownUntil || null,
          remainingSeconds: Number(latestRequirement.remainingSeconds || 0),
        }, 429);
      }

      const releaseCooldownClaim = async () => {
        const { error: releaseError } = await supabase.rpc("release_special_case_cooldown", {
          p_telegram_id: telegramUser.id,
          p_case_type: specialCaseType,
          p_claim_token: claimToken,
        });
        if (releaseError) console.error("Special case cooldown release failed:", releaseError.message);
      };

      const { error: grantError } = await supabase.rpc("grant_special_case_credit", {
        p_telegram_id: telegramUser.id,
        p_case_name: specialCase.rewardCaseName,
      });
      if (grantError) {
        await releaseCooldownClaim();
        console.error("Special case credit grant failed:", grantError.message);
        return respond({ error: "Специальные кейсы ещё не подключены к базе. Примени SQL-файл special-case-credits.sql из архива и повтори попытку." }, 503);
      }

      const { data, error } = await supabase.rpc("open_case", {
        p_telegram_id: telegramUser.id,
        p_case_name: specialCase.rewardCaseName,
      });
      if (error) {
        const { error: rollbackError } = await supabase.rpc("revoke_special_case_credit", {
          p_telegram_id: telegramUser.id,
          p_case_name: specialCase.rewardCaseName,
        });
        if (rollbackError) console.error("Special case credit rollback failed:", rollbackError.message);
        await releaseCooldownClaim();
        console.error("Special case opening failed:", error.message);
        return respond({ error: "Не удалось открыть специальный кейс. Попробуй ещё раз." }, 400);
      }

      let openedReward: any = data || {};
      if (typeof data === "string") {
        try { openedReward = JSON.parse(data); } catch { openedReward = {}; }
      }
      if (!openedReward || typeof openedReward !== "object" || openedReward?.success === false) {
        const { error: rollbackError } = await supabase.rpc("revoke_special_case_credit", {
          p_telegram_id: telegramUser.id,
          p_case_name: specialCase.rewardCaseName,
        });
        if (rollbackError) console.error("Special case credit rollback failed:", rollbackError.message);
        await releaseCooldownClaim();
        return respond({ error: String(openedReward?.error || "Не удалось открыть специальный кейс.") }, 400);
      }

      let completedCooldownAt: string | null = null;
      const { data: completedAt, error: completeCooldownError } = await supabase.rpc(
        "complete_special_case_cooldown",
        {
          p_telegram_id: telegramUser.id,
          p_case_type: specialCaseType,
          p_claim_token: claimToken,
        },
      );
      if (completeCooldownError) {
        console.error("Special case cooldown finalization failed:", completeCooldownError.message);
        // The atomic claim already wrote opened_at, so the player is still
        // protected. Try to finalize it directly as a recovery path so the
        // full 12-hour period starts after the successful opening.
        const fallbackOpenedAt = new Date().toISOString();
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("special_case_cooldowns")
          .update({ opened_at: fallbackOpenedAt, claim_token: null })
          .eq("telegram_id", telegramUser.id)
          .eq("case_type", specialCaseType)
          .eq("claim_token", claimToken)
          .select("opened_at");
        if (fallbackError) {
          console.error("Special case cooldown fallback failed:", fallbackError.message);
        } else {
          completedCooldownAt = fallbackRows?.[0]?.opened_at || null;
        }
      } else {
        completedCooldownAt = typeof completedAt === "string" ? completedAt : null;
      }

      await recordProgress("open_case", 1);
      const dropItemName = String(openedReward.item_name || openedReward.name || "").trim();
      if (dropItemName) {
        await recordGlobalActivity({
          eventType: "case_opened",
          title: "Открыл специальный кейс",
          description: `${dropItemName} · ${specialCase.displayName}${openedReward.mutation === "strawberry" ? " · 🍓 Strawberry ×2.5" : ""}`,
          itemName: dropItemName,
          caseName: specialCase.displayName,
          rarity: openedReward.rarity || null,
          valueGg: Number(openedReward.value_gg || openedReward.sold_price || 0),
          success: true,
        });
        const { error: dropInsertError } = await supabase.from("game_live_drops").insert({
          telegram_id: telegramUser.id,
          item_name: dropItemName,
          rarity: openedReward.rarity || null,
          value_gg: Number(openedReward.value_gg || openedReward.sold_price || 0),
          case_name: specialCase.displayName,
          mutation: openedReward.mutation || null,
        });
        if (dropInsertError) console.error("Special live drop event insert failed:", dropInsertError.message);
      }

      let credits;
      try {
        credits = await getFreeCaseCredits(supabase, telegramUser.id);
      } catch {
        credits = { free_case_credits: [], free_cases_total: 0 };
      }

      const cooldownOpenedAt = Date.parse(String(completedCooldownAt || cooldownClaim?.opened_at || ""));
      return respond({
        success: true,
        result: { ...openedReward, case_name: specialCase.displayName },
        special_case_cooldown: {
          case_type: specialCaseType,
          cooldown_until: Number.isFinite(cooldownOpenedAt)
            ? new Date(cooldownOpenedAt + SPECIAL_CASE_COOLDOWN_MS[specialCaseType]).toISOString()
            : null,
        },
        ...credits,
      });
    }

    // ОТКРЫТИЕ КЕЙСА
    if (body.action === "open_case") {
      const rawCaseName =
        typeof body.caseName === "string"
          ? body.caseName.trim()
          : "";

      const caseName = ALLOWED_CASES.find(
        (name) => name.toLowerCase() === rawCaseName.toLowerCase(),
      );

      if (!caseName) {
        return respond({ error: "Unknown case" }, 400);
      }

      const { data, error } = await supabase.rpc("open_case", {
        p_telegram_id: telegramUser.id,
        p_case_name: caseName,
      });

      if (error) {
        console.error("Case opening failed:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          caseName,
        });

        return respond({ error: error.message }, 400);
      }

      await recordProgress("open_case", 1);
      const openedReward: any = data || {};
      const dropItemName = String(openedReward.item_name || openedReward.name || "").trim();
      if (dropItemName) {
        await recordGlobalActivity({
          eventType: "case_opened",
          title: "Открыл кейс",
          description: `${dropItemName} · ${caseName}${openedReward.mutation === "strawberry" ? " · 🍓 Strawberry ×2.5" : ""}`,
          itemName: dropItemName,
          caseName,
          rarity: openedReward.rarity || null,
          valueGg: Number(openedReward.value_gg || openedReward.sold_price || 0),
          success: true,
        });
        const { error: dropInsertError } = await supabase.from("game_live_drops").insert({
          telegram_id: telegramUser.id,
          item_name: dropItemName,
          rarity: openedReward.rarity || null,
          value_gg: Number(openedReward.value_gg || openedReward.sold_price || 0),
          case_name: caseName,
          mutation: openedReward.mutation || null,
        });
        if (dropInsertError) console.error("Live drop event insert failed:", dropInsertError.message);
      }

      // После открытия обязательно перечитываем остаток из базы.
      let credits;

      try {
        credits = await getFreeCaseCredits(
          supabase,
          telegramUser.id,
        );
      } catch {
        credits = {
          free_case_credits: [],
          free_cases_total: 0,
        };
      }

      return respond({
        success: true,
        result: data,
        ...credits,
      });
    }

    // РЕГИСТРАЦИЯ И ЗАГРУЗКА ПРОФИЛЯ
    const { data: player, error } = await supabase
      .from("players")
      .upsert(
        {
          telegram_id: telegramUser.id,
          username: telegramUser.username ?? null,
        },
        { onConflict: "telegram_id" },
      )
      .select("telegram_id, game_id, username, balance, free_cases")
      .single();

    if (error) {
      console.error("Player registration failed:", error.message);
      return respond(
        { error: "Could not register player" },
        500,
      );
    }

    let credits;

    try {
      credits = await getFreeCaseCredits(
        supabase,
        telegramUser.id,
      );
    } catch {
      return respond(
        { error: "Could not load free case credits" },
        500,
      );
    }

    return respond({
      success: true,
      player: {
        ...player,
        game_id: player.username ? `@${player.username}` : null,
        public_game_id: player.username ? `@${player.username}` : null,
        ...credits,
      },
    });
  } catch (error) {
    console.error("Function error:", error);
    return respond(
      { error: "Internal server error" },
      500,
    );
  }
});

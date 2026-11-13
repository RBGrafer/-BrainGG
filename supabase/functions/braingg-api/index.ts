
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (req.headers.get("x-telegram-bot-api-secret-token") && webhookSecret) {
    if (req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
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
    const isAdmin = adminIds.includes(String(telegramUser.id));

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
        .select("id, telegram_id, item_name, rarity, value_gg, case_name, created_at")
        .order("created_at", { ascending: false }).limit(25);
      if (dropsError) console.error("Live drops loading failed:", dropsError.message);
      const dropIds = [...new Set((latestItems || []).map((item: any) => item.telegram_id))];
      const { data: dropPlayers } = dropIds.length
        ? await supabase.from("players").select("telegram_id, username").in("telegram_id", dropIds)
        : { data: [] };
      const usernames = new Map((dropPlayers || []).map((p: any) => [String(p.telegram_id), p.username]));
      const liveDrops = (latestItems || []).map((item: any) => ({
        id: item.id, item_name: item.item_name, rarity: item.rarity, value_gg: Number(item.value_gg || 0),
        created_at: item.created_at, case_name: item.case_name, username: usernames.get(String(item.telegram_id)) || "Игрок",
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
        return { username: p.username || "Игрок", game_id: p.game_id, xp, level: Math.floor(Math.sqrt(xp / 100)) + 1,
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
      const { data: player } = await supabase.from("players").select("balance").eq("telegram_id", telegramUser.id).maybeSingle();
      return respond({ success: true, result: data, balance: player?.balance });
    }

    if (body.action === "claim_task_reward") {
      const taskId = String(body.taskId || "");
      if (!GAME_TASKS.some((task) => task.id === taskId)) return respond({ error: "Неизвестное задание" }, 400);
      const { data, error } = await supabase.rpc("claim_task_reward", { p_telegram_id: telegramUser.id, p_task_id: taskId });
      if (error) { console.error("Task reward claim failed:", error.message); return respond({ error: "Не удалось получить награду" }, 400); }
      const { data: player } = await supabase.from("players").select("balance").eq("telegram_id", telegramUser.id).maybeSingle();
      return respond({ success: true, result: data, balance: player?.balance });
    }

    if (body.action === "admin_adjust_xp") {
      if (!isAdmin) return respond({ error: "Доступ запрещён" }, 403);
      const gameId = String(body.gameId || "").trim();
      const amount = Number(body.amount);
      if (!gameId || !Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) return respond({ error: "Некорректное количество XP" }, 400);
      const { data: targetPlayer, error: targetError } = await supabase.from("players").select("telegram_id").eq("game_id", gameId).maybeSingle();
      if (targetError || !targetPlayer) return respond({ error: "Игрок не найден" }, 404);
      const { data: xp, error } = await supabase.rpc("admin_adjust_player_xp", { p_player_telegram_id: targetPlayer.telegram_id, p_amount: amount });
      if (error) { console.error("Admin XP adjustment failed:", error.message); return respond({ error: "Не удалось начислить XP. Применена ли миграция Season 2?" }, 400); }
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
        return respond({ error: "Укажи корректный Game ID" }, 400);
      }

      const { data: player, error } = await supabase
        .from("players")
        .select("telegram_id, game_id, username, balance, free_cases")
        .eq("game_id", gameId)
        .maybeSingle();

      if (error) {
        console.error("Admin player lookup failed:", error.message);
        return respond({ error: "Не удалось найти игрока" }, 500);
      }

      if (!player) {
        return respond(
          { error: "Игрок с таким Game ID не найден" },
          404,
        );
      }

      const { data: inventory, error: inventoryError } = await supabase
        .from("inventory")
        .select("id, item_name, rarity, value_gg, created_at")
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

      const { data: player, error: playerError } = await supabase
        .from("players")
        .select("telegram_id, game_id")
        .eq("game_id", gameId)
        .maybeSingle();

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

      return respond({ success: true, logs: logs ?? [] });
    }

    // ИНВЕНТАРЬ
    if (body.action === "get_inventory") {
      const { data: items, error } = await supabase
        .from("inventory")
        .select("id, item_name, rarity, value_gg, created_at")
        .eq("telegram_id", telegramUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Inventory loading failed:", error.message);
        return respond({ error: "Could not load inventory" }, 500);
      }

      return respond({ success: true, items: items ?? [] });
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

      const { data, error } = await supabase.rpc(
        "sell_inventory_item",
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
      return respond({ success: true, result: data });
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

      return respond({ success: true, items: items ?? [] });
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

      const { data, error } = await supabase.rpc(
        "upgrade_inventory_item",
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
      return respond({ success: true, result: data });
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
        const { error: dropInsertError } = await supabase.from("game_live_drops").insert({
          telegram_id: telegramUser.id,
          item_name: dropItemName,
          rarity: openedReward.rarity || null,
          value_gg: Number(openedReward.value_gg || openedReward.sold_price || 0),
          case_name: caseName,
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

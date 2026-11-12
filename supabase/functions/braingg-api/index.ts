
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_CASES = [
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

      return respond({
        success: true,
        player: {
          ...player,
          ...credits,
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

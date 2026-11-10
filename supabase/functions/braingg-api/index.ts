
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    if (!botToken || !supabaseUrl || !serviceKey) {
      return respond({ error: "Server configuration is incomplete" }, 500);
    }

    const body = await req.json();
    const initData = body?.initData;

    if (typeof initData !== "string" || !initData) {
      return respond({ error: "Telegram data is missing" }, 400);
    }

    const telegramUser = await verifyTelegram(initData, botToken);

    if (!telegramUser?.id || !Number.isSafeInteger(telegramUser.id)) {
      return respond({ error: "Invalid Telegram authentication" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Загрузка инвентаря игрока
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

    // Продажа предмета
    if (body.action === "sell_item") {
      const inventoryId = Number(body.inventoryId);

      if (!Number.isSafeInteger(inventoryId) || inventoryId <= 0) {
        return respond({ error: "Invalid inventory item" }, 400);
      }

      const { data, error } = await supabase.rpc("sell_inventory_item", {
        p_telegram_id: telegramUser.id,
        p_inventory_id: inventoryId,
      });

      if (error) {
        console.error("Item sale failed:", error.message);
        return respond({ error: error.message }, 400);
      }

      return respond({ success: true, result: data });
    }

    // Список всех доступных целей для апгрейда
    if (body.action === "get_upgrade_targets") {
      const { data: items, error } = await supabase
        .from("case_rewards")
        .select("item_name, rarity, value_gg")
        .order("value_gg", { ascending: true });

      if (error) {
        console.error("Upgrade targets loading failed:", error.message);
        return respond({ error: "Could not load upgrade targets" }, 500);
      }

      return respond({ success: true, items: items ?? [] });
    }

    // Апгрейд предмета
    // Шанс рассчитывается SQL-функцией по стоимости предметов.
    // Клиент не может передать или подменить вероятность.
    if (body.action === "upgrade_item") {
      const inventoryId = Number(body.inventoryId);
      const targetItem = body.targetItem;

      if (
        !Number.isSafeInteger(inventoryId) ||
        inventoryId <= 0 ||
        typeof targetItem !== "string" ||
        !targetItem.trim()
      ) {
        return respond({ error: "Invalid upgrade parameters" }, 400);
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

    // Открытие кейса
    if (body.action === "open_case") {
      const caseName = body.caseName;

      if (
        ![
          "Starter Case",
          "Lucky Case",
          "Epic Case",
          "Legendary Case",
        ].includes(caseName)
      ) {
        return respond({ error: "Unknown case" }, 400);
      }

      const { data, error } = await supabase.rpc("open_case", {
        p_telegram_id: telegramUser.id,
        p_case_name: caseName,
      });

      if (error) {
        console.error("Case opening failed:", error.message);
        return respond({ error: error.message }, 400);
      }

      return respond({ success: true, result: data });
    }

    // Регистрация и загрузка профиля
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
      return respond({ error: "Could not register player" }, 500);
    }

    return respond({ success: true, player });
  } catch (error) {
    console.error("Function error:", error);
    return respond({ error: "Internal server error" }, 500);
  }
});

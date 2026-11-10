
import React, { useEffect, useState } from "react";
import { cases } from "./data/cases.js";
import { supabase } from "./supabase.js";

export default function App() {
  const [page, setPage] = useState("Главная");
  const [openCount, setOpenCount] = useState(1);
  const [selectedCase, setSelectedCase] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [authError, setAuthError] = useState("");
  const [lastRewards, setLastRewards] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState("");

  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [targetItem, setTargetItem] = useState("");
  const [upgradeResult, setUpgradeResult] = useState(null);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeRotation, setUpgradeRotation] = useState(0);
  const [sellingId, setSellingId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");

  const pages = ["Главная", "Кейсы", "Апгрейдер", "Инвентарь"];
  const initData = () => window.Telegram?.WebApp?.initData;

  const rarityColors = {
    "Обычный": "#a5a5b5",
    "Редкий": "#43a5ff",
    "Эпический": "#bd65ff",
    "Легендарный": "#ffbd45",
    "Мифический": "#ff5c9d",
  };

  useEffect(() => {
    async function registerPlayer() {
      if (!initData()) {
        setAuthError("Открой BrainGG через Telegram");
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "braingg-api",
          { body: { initData: initData() } }
        );

        if (error) throw error;
        if (!data?.success || !data?.player) {
          throw new Error(data?.error || "Не удалось загрузить игрока");
        }

        setPlayer(data.player);
      } catch (error) {
        console.error("Ошибка регистрации:", error);
        setAuthError("Не удалось подключиться к серверу");
      } finally {
        setLoading(false);
      }
    }

    registerPlayer();
  }, []);

  async function loadInventory() {
    setInventoryLoading(true);
    setInventoryError("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "get_inventory",
          },
        }
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Не удалось загрузить инвентарь");
      }

      setInventory(data.items || []);
    } catch (error) {
      console.error("Ошибка инвентаря:", error);
      setInventoryError("Не удалось загрузить инвентарь. Попробуй ещё раз.");
    } finally {
      setInventoryLoading(false);
    }
  }

  async function changePage(nextPage) {
    setPage(nextPage);

    if (nextPage === "Инвентарь" || nextPage === "Апгрейдер") {
      await loadInventory();
    }
  }

  async function openSelectedCase() {
    if (!selectedCase || !player || opening) return;

    setOpening(true);
    setLastRewards([]);
    const rewards = [];

    try {
      for (let i = 0; i < openCount; i++) {
        const { data, error } = await supabase.functions.invoke(
          "braingg-api",
          {
            body: {
              initData: initData(),
              action: "open_case",
              caseName: selectedCase.name,
            },
          }
        );

        if (error) throw error;
        if (!data?.success || !data?.result?.success) {
          throw new Error(data?.error || "Не удалось открыть кейс");
        }

        rewards.push(data.result);
        setPlayer((previous) => ({
          ...previous,
          balance: data.result.balance,
        }));
        setLastRewards([...rewards]);
      }

      await loadInventory();
      alert(`Готово! Открыто кейсов: ${rewards.length}`);
    } catch (error) {
      console.error("Ошибка открытия:", error);
      alert(
        rewards.length > 0
          ? `Открыто кейсов: ${rewards.length}. Остальные открыть не удалось.`
          : error.message || "Не удалось открыть кейс"
      );
    } finally {
      setOpening(false);
    }
  }

  async function sellItem(item) {
    if (sellingId || upgradeLoading) return;

    const price = Number(item.value_gg) || 0;
    if (!window.confirm(`Продать ${item.item_name} за ${price} GG?`)) return;

    setSellingId(item.id);
    setActionMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "sell_item",
            inventoryId: item.id,
          },
        }
      );

      if (error) throw error;
      if (!data?.success || !data?.result?.success) {
        throw new Error(data?.error || "Не удалось продать предмет");
      }

      setPlayer((previous) => ({
        ...previous,
        balance: data.result.balance,
      }));

      setInventory((previous) =>
        previous.filter((entry) => entry.id !== item.id)
      );

      if (selectedUpgrade?.id === item.id) {
        setSelectedUpgrade(null);
      }

      setActionMessage(
        `${data.result.item_name} продан за ${data.result.sold_price} GG!`
      );
    } catch (error) {
      console.error("Ошибка продажи:", error);
      setActionMessage(error.message || "Ошибка продажи");
    } finally {
      setSellingId(null);
    }
  }

  async function performUpgrade() {
    if (!selectedUpgrade || !targetItem || upgradeLoading) return;

    setUpgradeLoading(true);
    setUpgradeResult(null);
    setActionMessage("");

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "upgrade_item",
            inventoryId: selectedUpgrade.id,
            targetItem,
          },
        }
      );

      if (error) throw error;
      if (!data?.success || !data?.result?.success) {
        throw new Error(data?.error || "Не удалось выполнить апгрейд");
      }

      const result = data.result;
      const finalRotation = upgradeRotation + 360 * 5 + (result.won ? 45 : 225);

      setUpgradeRotation(finalRotation);

      await new Promise((resolve) => setTimeout(resolve, 3200));

      setUpgradeResult(result);
      setPlayer((previous) => ({
        ...previous,
        balance: result.balance,
      }));

      await loadInventory();
      setSelectedUpgrade(null);
      setTargetItem("");
    } catch (error) {
      console.error("Ошибка апгрейда:", error);
      setActionMessage(error.message || "Ошибка апгрейда");
    } finally {
      setUpgradeLoading(false);
    }
  }

  const possibleTargets = inventory
    .map((item) => ({
      name: item.item_name,
      rarity: item.rarity,
      value: Number(item.value_gg) || 0,
    }))
    .filter((item, index, array) =>
      array.findIndex((other) => other.name === item.name) === index
    );

  const selectedTarget = possibleTargets.find(
    (item) => item.name === targetItem
  );

  const upgradeChance =
    selectedUpgrade && selectedTarget && selectedTarget.value > 0
      ? Math.min(
          90,
          Math.max(
            1,
            (Number(selectedUpgrade.value_gg) / selectedTarget.value) * 90
          )
        )
      : 0;

  return (
    <div className="app">
      <header className="header">
        <div className="logo">💜 BrainGG</div>
        <div className="balance">
          🪙 {player ? player.balance : 0} GG
        </div>
      </header>

      {loading && (
        <div className="content">
          <p>Загружаем твой профиль...</p>
        </div>
      )}

      {!loading && authError && (
        <div className="content">
          <p>{authError}</p>
        </div>
      )}

      {!loading && !authError && (
        <>
          <nav className="navigation">
            {pages.map((item) => (
              <button
                key={item}
                className={page === item ? "active" : ""}
                onClick={() => changePage(item)}
              >
                {item}
              </button>
            ))}
          </nav>

          {page === "Главная" && (
            <main className="content">
              <h2>Добро пожаловать в BrainGG!</h2>
              <p>
                Открывай кейсы, собирай персонажей и улучшай свою коллекцию.
              </p>
              {player && (
                <>
                  <p>
                    Привет,{" "}
                    <b>
                      {player.username ? `@${player.username}` : "игрок"}!
                    </b>
                  </p>
                  <p>
                    Твой игровой ID: <b>{player.game_id}</b>
                  </p>
                </>
              )}
              <button
                className="main-button"
                onClick={() => changePage("Кейсы")}
              >
                Смотреть кейсы 🎁
              </button>
            </main>
          )}

          {page === "Кейсы" && (
            <main className="content">
              <h2>🎁 Кейсы BrainGG</h2>
              <p>Выбирай кейс и испытывай удачу!</p>

              <div className="case-grid">
                {cases.map((item) => (
                  <div className="case-card" key={item.id}>
                    <div className="case-emoji">{item.emoji}</div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className="case-price">
                      🪙 {item.price} GG
                    </div>
                    <button
                      className={
                        selectedCase?.id === item.id
                          ? "case-button selected"
                          : "case-button"
                      }
                      onClick={() => {
                        setSelectedCase(item);
                        setLastRewards([]);
                      }}
                    >
                      {selectedCase?.id === item.id
                        ? "Выбран ✓"
                        : "Выбрать кейс"}
                    </button>
                  </div>
                ))}
              </div>

              <div className="opening-panel">
                <h3>Количество открытий</h3>
                <div className="opening-options">
                  {[1, 3, 5].map((count) => (
                    <button
                      key={count}
                      className={
                        openCount === count
                          ? "count-button active"
                          : "count-button"
                      }
                      disabled={opening}
                      onClick={() => setOpenCount(count)}
                    >
                      ×{count}
                    </button>
                  ))}
                </div>

                {selectedCase ? (
                  <>
                    <p>
                      Выбран: <b>{selectedCase.name}</b>
                    </p>
                    <p>
                      Стоимость:{" "}
                      <b>{selectedCase.price * openCount} GG</b>
                    </p>
                  </>
                ) : (
                  <p>Сначала выбери кейс 👆</p>
                )}

                <button
                  className="main-button open-button"
                  disabled={!selectedCase || !player || opening}
                  onClick={openSelectedCase}
                >
                  {opening ? "Открываем..." : `Открыть ×${openCount}`}
                </button>

                {lastRewards.length > 0 && (
                  <div className="rewards-list">
                    <h3>🎉 Твои выпадения</h3>
                    {lastRewards.map((reward, index) => (
                      <div className="reward-item" key={index}>
                        <b>{reward.item_name}</b>
                        <span>{reward.rarity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </main>
          )}

          {page === "Апгрейдер" && (
            <main className="content">
              <h2>⚡ Апгрейдер</h2>
              <p>Выбери предмет из инвентаря и цель для улучшения.</p>

              {inventoryLoading && <p>Загружаем инвентарь...</p>}

              {!inventoryLoading && inventory.length === 0 && (
                <div className="opening-panel">
                  <h3>Инвентарь пуст</h3>
                  <p>Сначала открой кейс, чтобы получить предмет.</p>
                  <button
                    className="main-button"
                    onClick={() => changePage("Кейсы")}
                  >
                    Открыть кейсы
                  </button>
                </div>
              )}

              {!inventoryLoading && inventory.length > 0 && (
                <>
                  <h3>1. Выбери свой предмет</h3>
                  <div className="case-grid">
                    {inventory.map((item) => (
                      <button
                        key={item.id}
                        className={
                          selectedUpgrade?.id === item.id
                            ? "case-card selected"
                            : "case-card"
                        }
                        disabled={upgradeLoading}
                        onClick={() => {
                          setSelectedUpgrade(item);
                          setUpgradeResult(null);
                        }}
                      >
                        <div className="case-emoji">🧠</div>
                        <h3>{item.item_name}</h3>
                        <p style={{ color: rarityColors[item.rarity] }}>
                          {item.rarity}
                        </p>
                        <b>{item.value_gg} GG</b>
                      </button>
                    ))}
                  </div>

                  {selectedUpgrade && (
                    <div className="opening-panel">
                      <h3>2. Выбери цель апгрейда</h3>
                      <select
                        className="upgrade-select"
                        value={targetItem}
                        disabled={upgradeLoading}
                        onChange={(event) => {
                          setTargetItem(event.target.value);
                          setUpgradeResult(null);
                        }}
                      >
                        <option value="">Выбери персонажа</option>
                        {possibleTargets.map((target) => (
                          <option
                            key={target.name}
                            value={target.name}
                            disabled={
                              target.name === selectedUpgrade.item_name
                            }
                          >
                            {target.name} — {target.value} GG
                          </option>
                        ))}
                      </select>

                      <div className="upgrade-wheel">
                        <div
                          className="upgrade-wheel-fill"
                          style={{
                            background: `conic-gradient(#36e58c ${
                              upgradeChance * 3.6
                            }deg, #292438 0deg)`,
                          }}
                        />
                        <div className="upgrade-wheel-center">
                          <b>{upgradeChance.toFixed(1)}%</b>
                          <span>ШАНС</span>
                        </div>
                        <div
                          className="upgrade-pointer"
                          style={{
                            transform: `translateX(-50%) rotate(${upgradeRotation}deg)`,
                            transition: upgradeLoading
                              ? "transform 3s cubic-bezier(.12,.75,.18,1)"
                              : "none",
                          }}
                        >
                          ▲
                        </div>
                      </div>

                      <p>
                        Твой предмет: <b>{selectedUpgrade.item_name}</b>
                      </p>
                      {selectedTarget && (
                        <p>
                          Цель: <b>{selectedTarget.name}</b>
                        </p>
                      )}

                      <button
                        className="main-button"
                        disabled={
                          !targetItem ||
                          upgradeLoading ||
                          !selectedUpgrade
                        }
                        onClick={performUpgrade}
                      >
                        {upgradeLoading ? "Апгрейд..." : "⚡ Улучшить"}
                      </button>

                      {upgradeResult && (
                        <div className="rewards-list">
                          <h3>
                            {upgradeResult.won
                              ? "🎉 УСПЕХ! Предмет получен!"
                              : "💔 Не повезло! Предмет сгорел"}
                          </h3>
                          <p>
                            Шанс: {upgradeResult.chance}%
                          </p>
                          <b>{upgradeResult.target_item}</b>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {actionMessage && <p>{actionMessage}</p>}
              {inventoryError && <p>{inventoryError}</p>}
            </main>
          )}

          {page === "Инвентарь" && (
            <main className="content">
              <h2>🎒 Мой инвентарь</h2>
              <p>Все твои полученные брейнроты в одном месте!</p>

              {inventoryLoading && <p>Загружаем инвентарь...</p>}

              {inventoryError && (
                <>
                  <p>{inventoryError}</p>
                  <button className="main-button" onClick={loadInventory}>
                    Повторить
                  </button>
                </>
              )}

              {!inventoryLoading && !inventoryError && (
                <>
                  <div className="inventory-count">
                    Всего предметов: <b>{inventory.length}</b>
                  </div>

                  {inventory.length === 0 ? (
                    <div className="opening-panel">
                      <div className="case-emoji">🎁</div>
                      <h3>Пока здесь пусто</h3>
                      <p>Открой свой первый кейс!</p>
                      <button
                        className="main-button"
                        onClick={() => changePage("Кейсы")}
                      >
                        Перейти к кейсам
                      </button>
                    </div>
                  ) : (
                    <div className="case-grid">
                      {inventory.map((item) => (
                        <div className="case-card" key={item.id}>
                          <div className="case-emoji">🧠</div>
                          <h3>{item.item_name}</h3>
                          <div
                            className="case-price"
                            style={{
                              color: rarityColors[item.rarity] || "#fff",
                            }}
                          >
                            {item.rarity}
                          </div>
                          <p>
                            Получен:{" "}
                            {new Date(item.created_at).toLocaleDateString(
                              "ru-RU"
                            )}
                          </p>
                          <div className="case-price">
                            🪙 {item.value_gg ?? 10} GG
                          </div>
                          <button
                            className="main-button"
                            disabled={sellingId === item.id || upgradeLoading}
                            onClick={() => sellItem(item)}
                          >
                            {sellingId === item.id
                              ? "Продаём..."
                              : `Продать за ${item.value_gg ?? 10} GG`}
                          </button>
                          <button
                            className="case-button"
                            disabled={sellingId === item.id || upgradeLoading}
                            onClick={() => {
                              setSelectedUpgrade(item);
                              setTargetItem("");
                              setUpgradeResult(null);
                              changePage("Апгрейдер");
                            }}
                          >
                            ⚡ Улучшить
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {actionMessage && <p>{actionMessage}</p>}

                  <button
                    className="main-button"
                    onClick={loadInventory}
                    disabled={sellingId !== null}
                  >
                    Обновить инвентарь ↻
                  </button>
                </>
              )}
            </main>
          )}
        </>
      )}
    </div>
  );
}

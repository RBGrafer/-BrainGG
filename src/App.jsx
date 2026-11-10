
import React, { useEffect, useState } from "react";
import { cases } from "./data/cases.js";
import { supabase } from "./supabase.js";

function calculateUpgradeChance(source, target) {
  const sourcePrice = Number(source?.value_gg);
  const targetPrice = Number(target?.value_gg);

  if (
    !Number.isFinite(sourcePrice) ||
    !Number.isFinite(targetPrice) ||
    sourcePrice <= 0 ||
    targetPrice <= 0
  ) {
    return 0;
  }

  return Math.min(
    90,
    Math.max(0.1, (sourcePrice / targetPrice) * 100)
  );
}

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

  const [upgradeTargets, setUpgradeTargets] = useState([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [selectedUpgrade, setSelectedUpgrade] = useState(null);
  const [targetItem, setTargetItem] = useState("");
  const [upgradeChance, setUpgradeChance] = useState(50);
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
      setInventoryError(
        "Не удалось загрузить инвентарь. Попробуй ещё раз."
      );
    } finally {
      setInventoryLoading(false);
    }
  }

  async function loadUpgradeTargets() {
    setTargetsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "braingg-api",
        {
          body: {
            initData: initData(),
            action: "get_upgrade_targets",
          },
        }
      );

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || "Не удалось загрузить цели");
      }

      setUpgradeTargets(data.items || []);
    } catch (error) {
      console.error("Ошибка загрузки целей:", error);
      setActionMessage("Не удалось загрузить список целей апгрейда.");
    } finally {
      setTargetsLoading(false);
    }
  }

  function findClosestTarget(source, desiredChance) {
    if (!source || upgradeTargets.length === 0) return null;

    const possible = upgradeTargets
      .filter((item) => item.item_name !== source.item_name)
      .map((item) => ({
        ...item,
        actualChance: calculateUpgradeChance(source, item),
      }))
      .filter((item) => item.actualChance > 0);

    if (possible.length === 0) return null;

    possible.sort((a, b) => {
      const differenceA = Math.abs(a.actualChance - desiredChance);
      const differenceB = Math.abs(b.actualChance - desiredChance);

      if (differenceA !== differenceB) {
        return differenceA - differenceB;
      }

      // При одинаковом расстоянии предпочитаем шанс не выше выбранного.
      const aAbove = a.actualChance > desiredChance;
      const bAbove = b.actualChance > desiredChance;

      if (aAbove !== bAbove) return aAbove ? 1 : -1;

      return a.value_gg - b.value_gg;
    });

    return possible[0];
  }

  function chooseChance(preset) {
    setUpgradeChance(preset);
    setUpgradeResult(null);
    setActionMessage("");

    const closest = findClosestTarget(selectedUpgrade, preset);

    if (closest) {
      setTargetItem(closest.item_name);
    } else {
      setTargetItem("");
    }
  }

  function chooseSource(item) {
    setSelectedUpgrade(item);
    setUpgradeResult(null);
    setActionMessage("");

    const closest = findClosestTarget(item, upgradeChance);

    setTargetItem(closest?.item_name || "");
  }

  async function changePage(nextPage) {
    setPage(nextPage);
    setActionMessage("");

    if (nextPage === "Инвентарь" || nextPage === "Апгрейдер") {
      await loadInventory();
    }

    if (nextPage === "Апгрейдер" && upgradeTargets.length === 0) {
      await loadUpgradeTargets();
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

    if (!window.confirm(`Продать ${item.item_name} за ${price} GG?`)) {
      return;
    }

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
        setTargetItem("");
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
    if (
      !selectedUpgrade ||
      !targetItem ||
      !selectedTarget ||
      upgradeLoading
    ) {
      return;
    }

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
      const actualChance = Number(result.chance);

      const greenCenter = actualChance * 1.8;
      const darkCenter = 180 + actualChance * 1.8;

      const sectorCenter = result.won ? greenCenter : darkCenter;

      setUpgradeRotation(
        (previous) => previous + 360 * 5 - sectorCenter
      );

      await new Promise((resolve) => setTimeout(resolve, 4200));

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

  const selectedTarget = upgradeTargets.find(
    (item) => item.item_name === targetItem
  );

  const actualChance = selectedUpgrade && selectedTarget
    ? calculateUpgradeChance(selectedUpgrade, selectedTarget)
    : 0;

  const availableTargets = upgradeTargets
    .filter((item) => item.item_name !== selectedUpgrade?.item_name)
    .map((item) => ({
      ...item,
      actualChance: selectedUpgrade
        ? calculateUpgradeChance(selectedUpgrade, item)
        : null,
    }));

  const wheelAngle = actualChance * 3.6;

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
                    <div className="case-price">🪙 {item.price} GG</div>

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
                      Стоимость: <b>{selectedCase.price * openCount} GG</b>
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
            <main className="content upgrade-content">
              <div className="upgrade-heading">
                <div>
                  <h2>⚡ Апгрейдер BrainGG</h2>
                  <p>
                    Выбери своего брейнрота и цель, которую хочешь получить!
                  </p>
                </div>

                <div className="upgrade-badge">UPGRADE</div>
              </div>

              {inventoryLoading || targetsLoading ? (
                <div className="upgrade-empty">
                  <div className="loading-orb">⚡</div>
                  <p>Загружаем брейнротов...</p>
                </div>
              ) : inventory.length === 0 ? (
                <div className="upgrade-empty">
                  <div className="empty-brain">🧠</div>
                  <h3>У тебя пока нет брейнротов</h3>
                  <p>Открой кейс, чтобы получить первый предмет.</p>

                  <button
                    className="main-button"
                    onClick={() => changePage("Кейсы")}
                  >
                    Перейти к кейсам
                  </button>
                </div>
              ) : (
                <>
                  <div className="upgrade-arena">
                    <section className="upgrade-column">
                      <div className="upgrade-column-title">
                        <span>1</span>
                        <div>
                          <b>ТВОИ БРЕЙНРОТЫ</b>
                          <small>Выбери предмет, который отдаёшь</small>
                        </div>
                      </div>

                      <div className="upgrade-items-list">
                        {inventory.map((item) => (
                          <button
                            key={item.id}
                            className={
                              selectedUpgrade?.id === item.id
                                ? "upgrade-item selected"
                                : "upgrade-item"
                            }
                            disabled={upgradeLoading}
                            onClick={() => chooseSource(item)}
                          >
                            <span className="upgrade-item-emoji">🧠</span>

                            <span className="upgrade-item-info">
                              <b>{item.item_name}</b>

                              <small
                                style={{
                                  color: rarityColors[item.rarity],
                                }}
                              >
                                {item.rarity}
                              </small>

                              <small>{item.value_gg} GG</small>
                            </span>

                            {selectedUpgrade?.id === item.id && (
                              <span className="item-check">✓</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="upgrade-middle">
                      <div className="upgrade-wheel-wrap">
                        <div className="wheel-glow" />

                        <div
                          className="upgrade-wheel-rotor"
                          style={{
                            transform: `rotate(${upgradeRotation}deg)`,
                            background: `conic-gradient(#39e58b 0deg ${wheelAngle}deg, #292438 ${wheelAngle}deg 360deg)`,
                          }}
                        >
                          <div className="wheel-inner">
                            <span className="wheel-chance">
                              {selectedTarget
                                ? `${actualChance.toFixed(1)}%`
                                : "—"}
                            </span>

                            <span className="wheel-label">
                              РЕАЛЬНЫЙ ШАНС
                            </span>
                          </div>
                        </div>

                        <div className="upgrade-pointer" />
                      </div>

                      <div className="chance-title">
                        ВЫБЕРИ ЖЕЛАЕМЫЙ ШАНС
                      </div>

                      <div className="chance-options">
                        {[75, 50, 25, 10].map((chance) => (
                          <button
                            key={chance}
                            className={
                              upgradeChance === chance
                                ? "chance-button active"
                                : "chance-button"
                            }
                            disabled={upgradeLoading}
                            onClick={() => chooseChance(chance)}
                          >
                            {chance}%
                          </button>
                        ))}
                      </div>

                      <p className="chance-explanation">
                        Кнопка подберёт брейнрота с наиболее близким
                        настоящим шансом. Вероятность зависит от стоимости
                        предметов.
                      </p>

                      {selectedTarget && (
                        <div className="actual-chance-info">
                          <span>Настоящий шанс:</span>
                          <b>{actualChance.toFixed(2)}%</b>
                        </div>
                      )}

                      <button
                        className="main-button upgrade-start-button"
                        disabled={
                          !selectedUpgrade ||
                          !targetItem ||
                          !selectedTarget ||
                          upgradeLoading ||
                          targetsLoading
                        }
                        onClick={performUpgrade}
                      >
                        {upgradeLoading ? "КРУТИМ..." : "⚡ УЛУЧШИТЬ"}
                      </button>

                      <div className="wheel-legend">
                        <span>
                          <i className="legend-green" /> Победа
                        </span>
                        <span>
                          <i className="legend-dark" /> Проигрыш
                        </span>
                      </div>
                    </section>

                    <section className="upgrade-column">
                      <div className="upgrade-column-title target-title">
                        <span>2</span>
                        <div>
                          <b>БРЕЙНРОТЫ ДЛЯ ПОЛУЧЕНИЯ</b>
                          <small>Выбери желаемую цель</small>
                        </div>
                      </div>

                      <div className="upgrade-items-list">
                        {availableTargets.map((item) => (
                          <button
                            key={item.item_name}
                            className={
                              targetItem === item.item_name
                                ? "upgrade-item target-item selected"
                                : "upgrade-item target-item"
                            }
                            disabled={upgradeLoading}
                            onClick={() => {
                              setTargetItem(item.item_name);
                              setUpgradeResult(null);
                              setActionMessage("");
                            }}
                          >
                            <span className="upgrade-item-emoji">🧠</span>

                            <span className="upgrade-item-info">
                              <b>{item.item_name}</b>

                              <small
                                style={{
                                  color: rarityColors[item.rarity],
                                }}
                              >
                                {item.rarity}
                              </small>

                              <small>{item.value_gg} GG</small>

                              {selectedUpgrade && (
                                <small className="target-real-chance">
                                  Шанс: {item.actualChance.toFixed(2)}%
                                </small>
                              )}
                            </span>

                            {targetItem === item.item_name && (
                              <span className="item-check">✓</span>
                            )}
                          </button>
                        ))}

                        {availableTargets.length === 0 && (
                          <p className="no-targets">
                            Нет доступных целей.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="upgrade-selection-summary">
                    <div>
                      <small>ТВОЙ ПРЕДМЕТ</small>
                      <b>
                        {selectedUpgrade?.item_name || "Не выбран"}
                      </b>
                      {selectedUpgrade && (
                        <small>{selectedUpgrade.value_gg} GG</small>
                      )}
                    </div>

                    <div className="summary-arrow">➜</div>

                    <div>
                      <small>ТВОЯ ЦЕЛЬ</small>
                      <b>
                        {selectedTarget?.item_name || "Не выбрана"}
                      </b>
                      {selectedTarget && (
                        <small>{selectedTarget.value_gg} GG</small>
                      )}
                    </div>
                  </div>

                  {upgradeResult && (
                    <div
                      className={
                        upgradeResult.won
                          ? "upgrade-result win"
                          : "upgrade-result lose"
                      }
                    >
                      <div className="result-icon">
                        {upgradeResult.won ? "🏆" : "💔"}
                      </div>

                      <div>
                        <h3>
                          {upgradeResult.won
                            ? "ПОБЕДА! БРЕЙНРОТ ТВОЙ!"
                            : "НЕ ПОВЕЗЛО! БРЕЙНРОТ СГОРЕЛ"}
                        </h3>

                        <p>
                          {upgradeResult.won
                            ? `Ты получил ${upgradeResult.target_item}!`
                            : `Ты пытался получить ${upgradeResult.target_item}.`}
                        </p>

                        <small>
                          Настоящий шанс: {upgradeResult.chance}%
                        </small>
                      </div>
                    </div>
                  )}
                </>
              )}

              {actionMessage && (
                <div className="upgrade-message">
                  {actionMessage}
                </div>
              )}

              {inventoryError && (
                <div className="upgrade-message error">
                  {inventoryError}
                  <button onClick={loadInventory}>Повторить</button>
                </div>
              )}
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
                            🪙 {item.value_gg} GG
                          </div>

                          <button
                            className="main-button"
                            disabled={
                              sellingId === item.id || upgradeLoading
                            }
                            onClick={() => sellItem(item)}
                          >
                            {sellingId === item.id
                              ? "Продаём..."
                              : `Продать за ${item.value_gg} GG`}
                          </button>

                          <button
                            className="case-button"
                            disabled={
                              sellingId === item.id || upgradeLoading
                            }
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

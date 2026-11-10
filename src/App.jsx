
import React, { useState } from "react";

export default function App() {
  const [page, setPage] = useState("Главная");

  return (
    <div style={{
      minHeight: "100vh",
      background: "#090912",
      color: "white",
      fontFamily: "Arial, sans-serif",
      padding: "30px"
    }}>
      <h1 style={{ color: "#a855f7" }}>BrainGG</h1>
      <p>Добро пожаловать в BrainGG!</p>

      <nav style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {["Главная", "Кейсы", "Апгрейдер", "Инвентарь"].map(item => (
          <button
            key={item}
            onClick={() => setPage(item)}
            style={{
              padding: "12px 20px",
              borderRadius: "10px",
              border: "1px solid #7136a8",
              background: page === item ? "#7136a8" : "#171322",
              color: "white",
              cursor: "pointer"
            }}
          >
            {item}
          </button>
        ))}
      </nav>

      <h2 style={{ marginTop: "40px" }}>{page}</h2>
      <p>Раздел {page} скоро появится.</p>
    </div>
  );
}

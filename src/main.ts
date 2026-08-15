import "./styles/base.css";
import { renderTierBoard } from "./components/tierBoard";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="topbar">
    <span class="topbar__wordmark">MLB Tier List Maker</span>
  </header>
  <div class="layout">
    <aside class="query-builder">
      <h2 class="query-builder__heading">Build your pool</h2>
      <p class="query-builder__placeholder">Team and year filters coming next.</p>
    </aside>
    <div class="board-wrap">
      ${renderTierBoard()}
      <section class="pool">
        <h2 class="pool__heading">Unranked pool</h2>
        <p class="pool__placeholder">Players will appear here once a query runs.</p>
      </section>
    </div>
  </div>
`;

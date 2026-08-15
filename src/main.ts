import "./styles/base.css";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header class="topbar">
    <span class="topbar__wordmark">MLB Tier List Maker</span>
  </header>
  <main class="placeholder">
    <p>Project scaffolded. Build steps tracked in <code>docs/PLAN.md</code>.</p>
  </main>
`;

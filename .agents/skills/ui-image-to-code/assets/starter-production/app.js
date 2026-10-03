const views = {
  overview: ["可编辑生产页面", "这是脚手架提供的最小宿主页。请用识别和人工复核结果替换示例内容。"],
  components: ["组件结构", "给每个可编辑菜单、图标、文字和容器保留稳定的 data-ui-id。"],
  delivery: ["交付检查", "保存到项目后，由 Codex 审查 UI Document、证据和语义操作日志。"],
};

const buttons = [...document.querySelectorAll("[data-view]")];
const title = document.querySelector("#view-title");
const copy = document.querySelector("#view-copy");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const next = views[button.dataset.view];
    if (!next) return;
    buttons.forEach((item) => item.classList.toggle("is-active", item === button));
    title.textContent = next[0];
    copy.textContent = next[1];
  });
});

document.querySelector("#primary-action")?.addEventListener("click", () => {
  document.querySelector("[data-view='components']")?.click();
});

(function () {
  try {
    var theme = localStorage.getItem("lunheng-theme") || "dark";
    document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
    document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
  } catch {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
})();

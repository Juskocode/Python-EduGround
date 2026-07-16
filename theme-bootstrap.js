(function () {
  "use strict";

  try {
    var savedTheme = localStorage.getItem("fp-playground.theme.v1");
    var preferredTheme = matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    document.documentElement.dataset.theme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : preferredTheme;
  } catch (error) {
    document.documentElement.dataset.theme = "light";
  }
})();

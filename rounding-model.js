(function () {
  "use strict";

  function requireFinite(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      throw new TypeError("Rounding comparisons require a finite number.");
    }
    return number;
  }

  function normalizeZero(value) {
    return Object.is(value, -0) ? 0 : value;
  }

  function roundInteger(value) {
    var number = requireFinite(value);
    var lower = Math.floor(number);
    var upper = Math.ceil(number);
    var distanceToLower = number - lower;
    var distanceToUpper = upper - number;

    if (distanceToLower === distanceToUpper) {
      return normalizeZero(Math.abs(lower % 2) === 0 ? lower : upper);
    }
    return normalizeZero(distanceToLower < distanceToUpper ? lower : upper);
  }

  function compare(value) {
    var number = requireFinite(value);
    return Object.freeze({
      value: normalizeZero(number),
      floor: Math.floor(number),
      round: normalizeZero(roundInteger(number)),
      ceil: Math.ceil(number),
      trunc: normalizeZero(Math.trunc(number))
    });
  }

  function format(value) {
    return String(normalizeZero(requireFinite(value)));
  }

  window.ROUNDING_MODEL = Object.freeze({
    compare: compare,
    format: format,
    normalizeZero: normalizeZero,
    roundInteger: roundInteger
  });
})();

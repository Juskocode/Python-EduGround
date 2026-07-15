const PYODIDE_SOURCES = [
  {
    label: "jsDelivr",
    moduleUrl: "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/pyodide.mjs",
    indexUrl: "https://cdn.jsdelivr.net/pyodide/v314.0.2/full/",
  },
  {
    label: "UNPKG",
    moduleUrl: "https://unpkg.com/pyodide@0.27.7/pyodide.mjs",
    indexUrl: "https://unpkg.com/pyodide@0.27.7/",
  },
];

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function loadPythonRuntime() {
  const failures = [];

  for (const source of PYODIDE_SOURCES) {
    try {
      const pyodideModule = await import(source.moduleUrl);
      if (typeof pyodideModule.loadPyodide !== "function") {
        throw new Error("The loader module did not export loadPyodide().");
      }

      return await pyodideModule.loadPyodide({ indexURL: source.indexUrl });
    } catch (error) {
      failures.push(`${source.label}: ${errorMessage(error)}`);
    }
  }

  throw new Error(`All Python runtime sources failed. ${failures.join(" | ")}`);
}

// Keep loading inside the worker, but make the CDN import recoverable. A static
// cross-origin import fails before this module can post a useful error or try a
// backup source in browsers and networks that block that CDN.
const readyPromise = loadPythonRuntime();

readyPromise
  .then(() => self.postMessage({ type: "ready" }))
  .catch((error) => {
    self.postMessage({
      type: "startup-error",
      error: errorMessage(error),
    });
  });

self.addEventListener("message", async (event) => {
  const { id, code, mode, tests } = event.data || {};

  if (!id || typeof code !== "string" || !Array.isArray(tests)) {
    return;
  }

  try {
    const pyodide = await readyPromise;
    pyodide.globals.set("LAB_USER_CODE", code);
    pyodide.globals.set("LAB_MODE", mode);
    pyodide.globals.set("LAB_TESTS_JSON", JSON.stringify(tests));

    const resultJson = await pyodide.runPythonAsync(`
import contextlib
import io
import json
import math
import traceback

def _safe_repr(value):
    try:
        return repr(value)
    except Exception as exc:
        return f"<repr failed: {exc}>"

def _run_script_case(source, case):
    output = io.StringIO()
    errors = io.StringIO()
    input_values = iter(case.get("input", []))

    def fake_input(_prompt=""):
        try:
            return next(input_values)
        except StopIteration as exc:
            raise EOFError("The program requested more input than this test provides.") from exc

    namespace = {
        "__name__": "__main__",
        "__builtins__": __builtins__,
        "input": fake_input,
    }

    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
        exec(compile(source, "<learner-code>", "exec"), namespace)

    actual = output.getvalue()
    expected = case.get("expectedOutput", "")
    return actual == expected, repr(expected), repr(actual), actual, errors.getvalue()

def _run_function_case(source, case):
    output = io.StringIO()
    errors = io.StringIO()
    namespace = {
        "__name__": "exercise_module",
        "__builtins__": __builtins__,
    }

    with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
        exec(compile(source, "<learner-code>", "exec"), namespace)
        actual = eval(case["call"], namespace)
        expected = eval(case["expected"], namespace)

    if case.get("comparison") == "approx":
        tolerance = float(case.get("tolerance", 1e-9))
        passed = math.isclose(float(actual), float(expected), rel_tol=tolerance, abs_tol=tolerance)
    else:
        passed = actual == expected

    return passed, _safe_repr(expected), _safe_repr(actual), output.getvalue(), errors.getvalue()

def _run_all(source, mode, cases):
    results = []
    for case in cases:
        result = {
            "id": case.get("id", "test"),
            "name": case.get("name", "Test"),
            "hidden": bool(case.get("hidden", False)),
            "passed": False,
            "expected": "Not produced",
            "actual": "Not produced",
            "stdout": "",
            "stderr": "",
            "traceback": "",
        }
        try:
            if mode == "script":
                passed, expected, actual, stdout, stderr = _run_script_case(source, case)
            else:
                passed, expected, actual, stdout, stderr = _run_function_case(source, case)
            result.update({
                "passed": bool(passed),
                "expected": expected,
                "actual": actual,
                "stdout": stdout,
                "stderr": stderr,
            })
        except BaseException:
            result["traceback"] = traceback.format_exc()
        results.append(result)
    return results

json.dumps(_run_all(LAB_USER_CODE, LAB_MODE, json.loads(LAB_TESTS_JSON)))
`);

    self.postMessage({ type: "result", id, results: JSON.parse(resultJson) });
  } catch (error) {
    self.postMessage({
      type: "runner-error",
      id,
      error: errorMessage(error),
    });
  }
});

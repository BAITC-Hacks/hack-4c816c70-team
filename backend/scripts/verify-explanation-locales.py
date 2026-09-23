#!/usr/bin/env python3
"""Build and check explanation locales using only stdlib, loopback APIs and a fake OpenAI stub.

Run inside WSL from any directory:
    python3 backend/scripts/verify-explanation-locales.py

No .env file is loaded. API processes use explicit test settings and a local OpenAI
base URL; the stub never forwards requests. All owned processes and temporary
files are cleaned up even when an assertion fails. dotnet build may restore the
project's existing dependencies when they are not cached.
"""

import collections
import contextlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener

BACKEND = Path(__file__).resolve().parents[1]
PROJECT = BACKEND / "CitySimulator.Api" / "CitySimulator.Api.csproj"
EXAMPLE = {"choices": [
    {"measureId": "M7", "districtId": "nura"},
    {"measureId": "M8", "districtId": "nura"},
    {"measureId": "M10", "districtId": "nura"},
    {"measureId": "M12"},
    {"measureId": "M5", "districtId": "saryarka"},
]}
LANGUAGES = {
    "ru-RU": ("Итоговый Score", "Нура", "Сарыарка", "все районы", "52,96",
              "Заменить M5 (Сарыарка) на M3 (Нура)."),
    "kk-KZ": ("Қорытынды Score", "Нұра", "Сарыарқа", "барлық аудандар", "52,96",
              "M5 (Сарыарқа) шарасын M3 (Нұра) шарасымен алмастыру."),
    "en-US": ("Final Score", "Nura", "Saryarka", "all districts", "52.96",
              "Replace M5 (Saryarka) with M3 (Nura)."),
}
METADATA = {"explanation", "explanationSource", "explanationLocale"}
OPENER = build_opener(ProxyHandler({}))
CHECKS = 0
CASES = 0


def check(condition, message):
    global CHECKS
    CHECKS += 1
    if not condition:
        raise AssertionError(message)


def request(url, payload=None, language=None, timeout=10):
    headers = {}
    if language is not None:
        headers["Accept-Language"] = language
    body = None
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    try:
        response = OPENER.open(Request(url, data=body, headers=headers), timeout=timeout)
    except HTTPError as error:
        response = error
    with response:
        return response.status, dict(response.headers.items()), json.load(response)


def free_port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def test_environment(mode, port, stub_port):
    # Do not inherit real LLM configuration, proxy routing or development settings.
    excluded = ("OPENAI_", "LLM_", "ASPNETCORE_", "DOTNET_ENVIRONMENT")
    environment = {key: value for key, value in os.environ.items()
                   if not key.upper().startswith(excluded)
                   and key.upper() not in {"HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY"}}
    environment.update({
        "ASPNETCORE_URLS": f"http://127.0.0.1:{port}",
        "ASPNETCORE_ENVIRONMENT": "Production",
        "DOTNET_ENVIRONMENT": "Production",
        "DOTNET_SYSTEM_GLOBALIZATION_INVARIANT": "true",
        "LLM_MODE": mode,
        "OPENAI_API_KEY": "local-test-key" if mode == "live" else "",
        "OPENAI_MODEL": "local-test-model" if mode == "live" else "",
        "OPENAI_BASE_URL": f"http://127.0.0.1:{stub_port}/v1/",
        "FRONTEND_ORIGIN": "http://localhost:3000",
        "NO_PROXY": "127.0.0.1,localhost",
    })
    return environment


@contextlib.contextmanager
def running_api(build_directory, temporary, mode, stub_port):
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    log_path = temporary / f"api-{mode}.log"
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            ["dotnet", str(build_directory / "CitySimulator.Api.dll")],
            cwd=build_directory, env=test_environment(mode, port, stub_port),
            stdout=log, stderr=subprocess.STDOUT,
        )
        try:
            deadline = time.monotonic() + 25
            while time.monotonic() < deadline:
                if process.poll() is not None:
                    raise RuntimeError(f"Temporary API exited: {log_path.read_text()[-2500:]}")
                try:
                    status, _, health = request(base + "/health", timeout=0.4)
                    if status == 200 and health == {"status": "ok"}:
                        break
                except (URLError, TimeoutError, OSError):
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Temporary API did not become healthy in 25 seconds")
            yield base
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)


class StubState:
    def __init__(self):
        self.mode = "valid"
        self.calls = 0
        self.errors = []
        self.lock = threading.Lock()

    def snapshot(self):
        with self.lock:
            return self.calls, list(self.errors)


class OpenAiStub(BaseHTTPRequestHandler):
    state = None

    def log_message(self, *unused):
        pass

    def respond(self, status, payload):
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self):
        with self.state.lock:
            self.state.calls += 1
            mode = self.state.mode
        try:
            if self.path != "/v1/responses":
                raise AssertionError("Stub received an unexpected API path")
            if self.headers.get("Authorization") != "Bearer local-test-key":
                raise AssertionError("Stub received an unexpected test credential")
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            if payload.get("model") != "local-test-model" or payload.get("store") is not False:
                raise AssertionError("Unexpected model or store option")
            schema_format = payload["text"]["format"]
            if schema_format["type"] != "json_schema" or schema_format["strict"] is not True:
                raise AssertionError("Structured Outputs must remain strict")
            schema = schema_format["schema"]
            if schema.get("additionalProperties") is not False:
                raise AssertionError("Schema must reject extra properties")
            if set(schema["properties"]) != {"strengthOrder", "riskOrder"}:
                raise AssertionError("Unexpected ordering schema")
            order = {}
            for field in ("strengthOrder", "riskOrder"):
                section = schema["properties"][field]
                ids = section["items"].get("enum", [])
                if section.get("minItems") != len(ids) or section.get("maxItems") != len(ids):
                    raise AssertionError("Schema does not enforce the exact catalog length")
                order[field] = list(reversed(ids))
            if mode == "unauthorized":
                self.respond(401, {"error": {"message": "Local test authentication failure"}})
                return
            if mode == "invalid_order":
                if not order["strengthOrder"]:
                    raise AssertionError("The reference scenario should have strength claims")
                order["strengthOrder"].pop()
            self.respond(200, {
                "status": "completed",
                "output": [{"type": "message", "content": [
                    {"type": "output_text", "text": json.dumps(order)}]}],
                "usage": {"input_tokens": 10, "output_tokens": 10, "total_tokens": 20},
            })
        except Exception as error:
            with self.state.lock:
                self.state.errors.append(str(error))
            self.respond(400, {"error": {"message": "Local stub contract check failed"}})


def numeric_scenario_fields(result):
    return {key: value for key, value in result.items() if key not in METADATA}


def verify_result(status, headers, result, locale, source, reference, description):
    check(status == 200, f"{description}: expected 200, got {status}")
    check((result["spent"], result["remaining"], result["score"], result["baselineScore"])
          == (95, 5, 56.54, 52.56), f"{description}: reference calculation changed")
    check(result["explanationSource"] == source, f"{description}: wrong explanationSource")
    check(result["explanationLocale"] == locale, f"{description}: wrong explanationLocale")
    response_headers = {key.lower(): value for key, value in headers.items()}
    check(response_headers.get("content-language") == locale, f"{description}: wrong Content-Language")
    check(numeric_scenario_fields(result) == reference, f"{description}: numeric/scenario fields changed")
    explanation = result["explanation"]
    check(set(explanation) == {"summary", "strengths", "risks", "recommendations"},
          f"{description}: explanation DTO changed")
    prefix, nura, saryarka, city, number, replacement = LANGUAGES[locale]
    check(explanation["summary"].startswith(prefix), f"{description}: untranslated summary")
    check(f"{nura} ({number})" in explanation["summary"], f"{description}: wrong district or decimal format")
    check(any(nura in item and number in item for item in explanation["risks"]),
          f"{description}: missing localized weakest district")
    recommendations = explanation["recommendations"]
    check(recommendations[0].startswith(replacement), f"{description}: source/target replacement districts changed")
    check(any(f"M14 ({city})" in item for item in recommendations),
          f"{description}: citywide scope was not localized")
    text = " ".join([explanation["summary"], *explanation["strengths"], *explanation["risks"], *recommendations])
    check(saryarka in text, f"{description}: expected district is missing")
    if locale == "en-US":
        check(re.search(r"[\u0400-\u052f]", text) is None, f"{description}: English explanation contains Cyrillic")
    else:
        check("56,54" in explanation["summary"] and "56.54" not in explanation["summary"],
              f"{description}: decimal comma is missing")


def verify_swagger(base):
    status, _, swagger = request(base + "/swagger/v1/swagger.json")
    check(status == 200, "Swagger is unavailable")
    operation = swagger["paths"]["/api/simulations/evaluate"]["post"]
    language_parameters = [parameter for parameter in operation.get("parameters", [])
                           if parameter.get("name", "").lower() == "accept-language"]
    check(len(language_parameters) == 1, "Swagger must expose one Accept-Language parameter")
    parameter = language_parameters[0]
    check(parameter.get("in") == "header" and not parameter.get("required", False),
          "Accept-Language must be an optional header")
    response_schema = swagger["components"]["schemas"]["EvaluateResponse"]
    check(response_schema["properties"]["explanationLocale"]["type"] == "string",
          "Swagger must expose explanationLocale")
    check(set(swagger["components"]["schemas"]["EvaluateRequest"]["properties"]) == {"choices"},
          "Locale must not change the request body contract")


def main():
    global CASES
    state = StubState()
    OpenAiStub.state = state
    server = ThreadingHTTPServer(("127.0.0.1", 0), OpenAiStub)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)
    thread.start()
    try:
        with tempfile.TemporaryDirectory(prefix="hackalem-locale-check-") as directory:
            temporary = Path(directory)
            build_directory = temporary / "build"
            build = subprocess.run(
                ["dotnet", "build", str(PROJECT), "--nologo", "--verbosity", "quiet", "--output", str(build_directory)],
                cwd=BACKEND, env=test_environment("mock", 0, server.server_port),
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=120,
            )
            check(build.returncode == 0, "dotnet build failed: " + build.stdout)
            print("Build passed; all API calls use temporary loopback services.", flush=True)
            mock_results = {}
            with running_api(build_directory, temporary, "mock", server.server_port) as base:
                status, _, scenario_reference = request(base + "/api/scenario")
                check(status == 200, "Scenario endpoint is unavailable")
                check((scenario_reference["budget"], scenario_reference["baselineScore"], len(scenario_reference["districts"]))
                      == (100, 52.56, 5), "Reference scenario changed")
                reference = None
                for locale in LANGUAGES:
                    status, headers, result = request(base + "/api/simulations/evaluate", EXAMPLE, locale)
                    if reference is None:
                        reference = numeric_scenario_fields(result)
                    verify_result(status, headers, result, locale, "mock", reference, "mock " + locale)
                    mock_results[locale] = result
                    check(request(base + "/api/scenario", language=locale)[2] == scenario_reference,
                          "Scenario must not depend on explanation locale")
                    CASES += 1
                verify_swagger(base)
                header_cases = [
                    (None, "ru-RU"), ("fr-FR,de-DE;q=0.8", "ru-RU"),
                    ("ru;q=0.1,en-US;q=0.6,kk-KZ;q=0.9", "kk-KZ"),
                    ("en;q=0.7,kk;q=0.7", "en-US"),
                    ("ru", "ru-RU"), ("kk", "kk-KZ"), ("en", "en-US"),
                    ("en-GB", "en-US"), ("kk;q=0,en;q=0.4", "en-US"),
                    ("ru;q=0,kk;q=0,en;q=0", "ru-RU"),
                    ("en;q=invalid,kk;q=0.6", "kk-KZ"),
                    ("en;q=01,kk;q=0.9", "kk-KZ"),
                    ("en;q=0.9999,kk;q=0.9", "kk-KZ"),
                    ("en;q=1.000", "en-US"),
                    ("de-DE,en;q=0.5", "en-US"),
                ]
                for header, expected in header_cases:
                    status, headers, result = request(base + "/api/simulations/evaluate", EXAMPLE, header)
                    verify_result(status, headers, result, expected, "mock", reference, "header " + repr(header))
                    check(result["explanation"] == mock_results[expected]["explanation"],
                          "Header negotiation changed the selected locale's text")
                    CASES += 1
                check(state.snapshot()[0] == 0, "Mock must make no OpenAI requests")
                print("Mock languages, header negotiation and Swagger passed.", flush=True)

            with running_api(build_directory, temporary, "live", server.server_port) as base:
                for mode in ("valid", "unauthorized", "invalid_order"):
                    with state.lock:
                        state.mode = mode
                    for locale in LANGUAGES:
                        before, _ = state.snapshot()
                        status, headers, result = request(base + "/api/simulations/evaluate", EXAMPLE, locale)
                        source = "llm" if mode == "valid" else "mock"
                        description = mode + " " + locale
                        verify_result(status, headers, result, locale, source, reference, description)
                        after, errors = state.snapshot()
                        check(after - before == 1, description + ": expected one stub call, with no retries")
                        check(not errors, "Stub contract failed: " + "; ".join(errors))
                        explanation = result["explanation"]
                        default = mock_results[locale]["explanation"]
                        for field in ("summary", "recommendations"):
                            check(explanation[field] == default[field], description + ": server-owned " + field + " changed")
                        for field in ("strengths", "risks"):
                            expected = list(reversed(default[field])) if mode == "valid" else default[field]
                            check(explanation[field] == expected, description + ": wrong " + field + " order")
                            check(collections.Counter(explanation[field]) == collections.Counter(default[field]),
                                  description + ": claim text set changed")
                        check(request(base + "/api/scenario", language=locale)[2] == scenario_reference,
                              description + ": scenario data changed")
                        CASES += 1
                    print(mode + " passed for ru-RU, kk-KZ and en-US.", flush=True)
            check(state.snapshot()[0] == 9, "Expected exactly nine local stub requests")
            print(f"PASS: {CHECKS} assertions across {CASES} evaluation cases; no real OpenAI requests.")
            for locale, result in mock_results.items():
                print(locale + ": " + result["explanation"]["summary"])
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, RuntimeError, ValueError, subprocess.SubprocessError) as error:
        print("FAIL: " + str(error), file=sys.stderr)
        sys.exit(1)

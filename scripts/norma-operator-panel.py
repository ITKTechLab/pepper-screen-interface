#!/usr/bin/env python3
"""Simple operator panel for Norma runtime on Nuuk.

No external dependencies. Uses Tkinter and existing shell runner commands.
"""

from __future__ import annotations

import os
import subprocess
import threading

try:
    import tkinter as tk
    from tkinter import scrolledtext
    TK_AVAILABLE = True
except Exception:
    TK_AVAILABLE = False


REPO_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RUNNER = os.path.join(REPO_DIR, "scripts", "norma-runner.sh")


class OperatorPanel:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Norma Driftpanel")
        self.root.geometry("920x650")
        self.root.minsize(820, 560)

        self.status_var = tk.StringVar(value="Tryk 'Status' for at hente driftstilstand.")
        self.next_step_var = tk.StringVar(value="Næste skridt: Tryk 'Status'.")

        top = tk.Frame(root, padx=12, pady=12)
        top.pack(fill=tk.X)

        button_row = tk.Frame(top)
        button_row.pack(fill=tk.X, pady=(0, 8))

        self._make_button(button_row, "Start", lambda: self.run_action("start"))
        self._make_button(button_row, "Vis skærm", lambda: self.run_action("show"))
        self._make_button(button_row, "Status", lambda: self.run_action("status"))
        self._make_button(button_row, "Genstart", lambda: self.run_action("restart"))
        self._make_button(button_row, "Stop", lambda: self.run_action("stop"))

        info = tk.Label(
            top,
            text=(
                "Brug: 1) Start  2) Vent 10-20 sek  3) Vis skærm\n"
                "Hvis noget fejler: kør Status og følg Næste skridt-feltet."
            ),
            justify=tk.LEFT,
            anchor="w",
            font=("Arial", 11),
        )
        info.pack(fill=tk.X)

        status_frame = tk.Frame(root, padx=12)
        status_frame.pack(fill=tk.X, pady=(0, 12))

        status_label = tk.Label(
            status_frame,
            textvariable=self.status_var,
            justify=tk.LEFT,
            anchor="w",
            font=("Arial", 11, "bold"),
            fg="#0e3a6b",
        )
        status_label.pack(fill=tk.X, pady=(6, 4))

        next_step_label = tk.Label(
            status_frame,
            textvariable=self.next_step_var,
            justify=tk.LEFT,
            anchor="w",
            font=("Arial", 11),
            fg="#5b2a00",
        )
        next_step_label.pack(fill=tk.X)

        log_frame = tk.Frame(root, padx=12)
        log_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 12))

        self.output = scrolledtext.ScrolledText(log_frame, wrap=tk.WORD, font=("Courier New", 10))
        self.output.pack(fill=tk.BOTH, expand=True)
        self.output.insert(tk.END, "Norma Driftpanel klar.\n")

    def _make_button(self, parent: tk.Widget, text: str, command) -> None:
        btn = tk.Button(
            parent,
            text=text,
            command=command,
            font=("Arial", 12, "bold"),
            padx=16,
            pady=12,
            width=12,
        )
        btn.pack(side=tk.LEFT, padx=(0, 8))

    def append_output(self, text: str) -> None:
        self.output.insert(tk.END, text + "\n")
        self.output.see(tk.END)

    def run_action(self, action: str) -> None:
        thread = threading.Thread(target=self._run_action_worker, args=(action,), daemon=True)
        thread.start()

    def _run_action_worker(self, action: str) -> None:
        self.root.after(0, self.append_output, "\n>>> Kører: {}".format(action))
        try:
            result = subprocess.run(
                [RUNNER, action],
                cwd=REPO_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                check=False,
            )
            out = (result.stdout or "").rstrip()
        except Exception as exc:
            self.root.after(0, self.append_output, "Fejl under kørsel: {}".format(exc))
            self.root.after(0, self.status_var.set, "Driftpanel-fejl")
            self.root.after(0, self.next_step_var.set, "Næste skridt: Kontakt teknisk ansvarlig.")
            return

        if out:
            self.root.after(0, self.append_output, out)

        if action in ("start", "stop", "restart", "show", "status"):
            self._refresh_status_from_runner_output(out)

    def _refresh_status_from_runner_output(self, status_output: str) -> None:
        # Parse keys from runner status output. Keep robust to minor wording changes.
        lines = [line.strip() for line in status_output.splitlines() if line.strip()]

        runner = "ukendt"
        bridge_ok = None
        robot_link_ok = None
        screen_ok = None

        for line in lines:
            low = line.lower()
            if low.startswith("runner:"):
                runner = line.split(":", 1)[1].strip()
            elif low.startswith("bridge endpoint:"):
                bridge_ok = "ok" in low
            elif low.startswith("robot link:"):
                robot_link_ok = "ok" in low
            elif low.startswith("screen endpoint:"):
                screen_ok = "ok" in low

        summary = "Runner: {} | Bridge: {} | Robot: {} | Skærm: {}".format(
            runner,
            "OK" if bridge_ok else ("FEJL" if bridge_ok is False else "?"),
            "OK" if robot_link_ok else ("FEJL" if robot_link_ok is False else "?"),
            "OK" if screen_ok else ("FEJL" if screen_ok is False else "?"),
        )
        self.root.after(0, self.status_var.set, summary)

        if "stoppet" in runner.lower():
            next_step = "Næste skridt: Tryk 'Start'. Når den er klar, tryk 'Vis skærm'."
        elif bridge_ok is False and screen_ok is True:
            next_step = (
                "Næste skridt: Bridge svarer ikke. Norma er sandsynligvis slukket eller utilgængelig på netværket. "
                "Tænd Norma, vent, tryk derefter 'Genstart'."
            )
        elif bridge_ok and robot_link_ok is False:
            next_step = (
                "Næste skridt: Bridge kører, men robot-link er nede. Tænd Norma og netværk, "
                "tryk derefter 'Genstart'."
            )
        elif bridge_ok and screen_ok:
            next_step = "Næste skridt: Klar til borgere. Hvis tablet ikke skifter, tryk 'Vis skærm'."
        elif screen_ok is False:
            next_step = "Næste skridt: Tryk 'Genstart'. Hvis det fejler, kontakt teknisk ansvarlig."
        else:
            next_step = "Næste skridt: Tryk 'Status' igen om 5 sekunder."

        self.root.after(0, self.next_step_var.set, next_step)


def run_runner_action(action: str) -> str:
    result = subprocess.run(
        [RUNNER, action],
        cwd=REPO_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        check=False,
    )
    return (result.stdout or "").rstrip()


def derive_next_step(status_output: str) -> tuple[str, str]:
    lines = [line.strip() for line in status_output.splitlines() if line.strip()]

    runner = "ukendt"
    bridge_ok = None
    robot_link_ok = None
    screen_ok = None

    for line in lines:
        low = line.lower()
        if low.startswith("runner:"):
            runner = line.split(":", 1)[1].strip()
        elif low.startswith("bridge endpoint:"):
            bridge_ok = "ok" in low
        elif low.startswith("robot link:"):
            robot_link_ok = "ok" in low
        elif low.startswith("screen endpoint:"):
            screen_ok = "ok" in low

    summary = "Runner: {} | Bridge: {} | Robot: {} | Skaerm: {}".format(
        runner,
        "OK" if bridge_ok else ("FEJL" if bridge_ok is False else "?"),
        "OK" if robot_link_ok else ("FEJL" if robot_link_ok is False else "?"),
        "OK" if screen_ok else ("FEJL" if screen_ok is False else "?"),
    )

    if "stoppet" in runner.lower():
        next_step = "Naeste skridt: vaelg Start. Naar den er klar, vaelg Vis skaerm."
    elif bridge_ok is False and screen_ok is True:
        next_step = (
            "Naeste skridt: Bridge svarer ikke. Norma er sandsynligvis slukket/net ude. "
            "Taend Norma, vent, vaelg Genstart."
        )
    elif bridge_ok and robot_link_ok is False:
        next_step = (
            "Naeste skridt: Bridge koerer, men robot-link er nede. "
            "Taend Norma og netvaerk, vaelg Genstart."
        )
    elif bridge_ok and screen_ok:
        next_step = "Naeste skridt: Klar til borgere. Hvis tablet ikke skifter, vaelg Vis skaerm."
    elif screen_ok is False:
        next_step = "Naeste skridt: Vaelg Genstart. Hvis det fejler, kontakt teknisk ansvarlig."
    else:
        next_step = "Naeste skridt: Vaelg Status igen om 5 sekunder."

    return summary, next_step


def run_terminal_panel() -> None:
    print("Norma Driftpanel (terminal-fallback)")
    print("Tkinter mangler paa systemet, saa panel koerer i terminal.")
    print("")

    actions = {
        "1": ("start", "Start"),
        "2": ("show", "Vis skaerm"),
        "3": ("status", "Status"),
        "4": ("restart", "Genstart"),
        "5": ("stop", "Stop"),
    }

    while True:
        print("Vælg handling:")
        print("  1) Start")
        print("  2) Vis skaerm")
        print("  3) Status")
        print("  4) Genstart")
        print("  5) Stop")
        print("  q) Luk")
        choice = input("> ").strip().lower()

        if choice == "q":
            print("Lukker driftpanel.")
            return

        if choice not in actions:
            print("Ugyldigt valg. Proev igen.\n")
            continue

        action, label = actions[choice]
        print("\n>>> Koerer: {}".format(label))
        try:
            output = run_runner_action(action)
        except Exception as exc:
            print("Fejl under koersel: {}".format(exc))
            continue

        if output:
            print(output)

        if action in ("start", "stop", "restart", "show", "status"):
            summary, next_step = derive_next_step(output)
            print("\n{}".format(summary))
            print(next_step)

        print("")


def main() -> None:
    force_tty = os.environ.get("NORMA_FORCE_TTY", "").strip().lower() in ("1", "true", "yes")

    if TK_AVAILABLE and not force_tty:
        root = tk.Tk()
        OperatorPanel(root)
        root.mainloop()
        return

    run_terminal_panel()


if __name__ == "__main__":
    main()

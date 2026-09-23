#!/usr/bin/env python3
"""Reject AI/bot attribution; inspect only outgoing commits during pre-push."""

from pathlib import Path
import re
import subprocess
import sys

AI_IDENTITY = re.compile(r"codex|claude|openai|anthropic|chatgpt|copilot|\[bot\]|(?<![a-z0-9])bot(?![a-z0-9])", re.I)
TRAILER = re.compile(r"^\s*(?:co-authored-by|signed-off-by)\s*:\s*(.*)$", re.I)
GENERATED = re.compile(r"^\s*generated(?:\s+|[-_])(?:by|with)\b.*$", re.I)
ROBOT_ATTRIBUTION = re.compile(r"^\s*🤖")


class Rejected(Exception):
    pass


def git(*arguments):
    result = subprocess.run(
        ["git", *arguments], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="replace",
    )
    if result.returncode:
        raise Rejected("Git inspection failed: " + result.stderr.strip())
    return result.stdout


def check_identity(identity, label):
    if AI_IDENTITY.search(identity):
        raise Rejected(label + ": AI/bot identity is not allowed. Use your personal Git author and committer identity.")


def check_message(message, label):
    for line in message.splitlines():
        trailer = TRAILER.match(line)
        if (trailer and AI_IDENTITY.search(trailer.group(1))) or (
            GENERATED.match(line) and AI_IDENTITY.search(line)
        ) or ROBOT_ATTRIBUTION.match(line):
            raise Rejected(label + ": remove AI co-author, sign-off or generated-by attribution. Technical AI mentions are allowed.")


def check_commit(commit):
    fields = git("show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce%x00%B", commit).split("\0", 4)
    if len(fields) != 5:
        raise Rejected("Could not inspect outgoing commit " + commit[:12])
    author, author_email, committer, committer_email, message = fields
    check_identity(author + " <" + author_email + ">", commit[:12] + " author")
    check_identity(committer + " <" + committer_email + ">", commit[:12] + " committer")
    check_message(message, commit[:12] + " message")


def zero_object(object_id):
    return bool(object_id) and set(object_id) == {"0"}


def check_push():
    visited = set()
    for line in sys.stdin:
        fields = line.split()
        if len(fields) != 4:
            raise Rejected("Invalid pre-push input; expected local ref/OID and remote ref/OID.")
        _, local_new, _, remote_old = fields
        if zero_object(local_new):
            continue  # Deleting a ref introduces no commits.
        if zero_object(remote_old):
            commits = git("rev-list", local_new, "--not", "--remotes").splitlines()
        else:
            known_remote = subprocess.run(
                ["git", "cat-file", "-e", remote_old + "^{commit}"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            ).returncode == 0
            commits = git("rev-list", remote_old + ".." + local_new).splitlines() if known_remote else git("rev-list", local_new, "--not", "--remotes").splitlines()
        for commit in commits:
            if commit not in visited:
                check_commit(commit)
                visited.add(commit)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "pre-commit":
        check_identity(git("var", "GIT_AUTHOR_IDENT"), "Current author")
        check_identity(git("var", "GIT_COMMITTER_IDENT"), "Current committer")
    elif mode == "commit-msg" and len(sys.argv) > 2:
        check_message(Path(sys.argv[2]).read_text(encoding="utf-8", errors="replace"), "Commit message")
    elif mode == "pre-push":
        check_push()
    else:
        raise Rejected("Usage: check-personal-authorship.py pre-commit | commit-msg PATH | pre-push")


if __name__ == "__main__":
    try:
        main()
    except (Rejected, OSError) as error:
        print("[personal-authorship] " + str(error), file=sys.stderr)
        sys.exit(1)

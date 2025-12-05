import os
import sys
from datetime import datetime

# ============================================================
#  Logging Helper
# ============================================================

def log(section: str, message: str, *, timestamp: bool = True):
    """
    Print a clean, consistent, professional log message.

    Example output:
    [SCREEN][2025-01-01 12:30:22] Revenue screening started...
    """
    if timestamp:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{section}][{ts}] {message}")
    else:
        print(f"[{section}] {message}")


# ============================================================
#  Project Root Helper
# ============================================================

def get_project_root() -> str:
    """
    Returns the root directory of the project regardless of where
    the script is executed from.

    Example:
        /Users/darshil/investing-ai-engine
    """
    current = os.path.abspath(__file__)
    src_folder = os.path.dirname(current)
    project_root = os.path.dirname(src_folder)
    return project_root


# ============================================================
#  Directory Utility
# ============================================================

def ensure_dir(path: str):
    """
    Create a directory if it does not already exist.
    """
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)


# ============================================================
#  Path Builders
# ============================================================

def output_path(filename: str) -> str:
    """
    Returns the full path to a file inside the project's output folder.
    """
    root = get_project_root()
    out_dir = os.path.join(root, "output")
    ensure_dir(out_dir)
    return os.path.join(out_dir, filename)


def data_path(filename: str) -> str:
    """
    Returns the full path to a file inside the data folder.
    """
    root = get_project_root()
    data_dir = os.path.join(root, "data")
    ensure_dir(data_dir)
    return os.path.join(data_dir, filename)


def prompt_path(filename: str) -> str:
    """
    Returns the full path to a file in the prompts folder.
    """
    root = get_project_root()
    p_dir = os.path.join(root, "prompts")
    ensure_dir(p_dir)
    return os.path.join(p_dir, filename)

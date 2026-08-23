"""Config loader: reads ~/.codey/config.yaml + project .codey.yaml, merges, validates."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

from codey.config.schema import CodeYConfig

# Sentinel paths
GLOBAL_CONFIG_DIR = Path.home() / ".codey"
GLOBAL_CONFIG_FILE = GLOBAL_CONFIG_DIR / "config.yaml"
PROJECT_CONFIG_FILE = ".codey.yaml"
DEFAULT_CONFIG_PATH = Path(__file__).parent / "default_config.yaml"


def _deep_merge(base: dict, override: dict) -> dict:
    """Recursively merge *override* into *base*, returning a new dict.

    - dict values are merged recursively.
    - All other types in *override* replace the corresponding key in *base*.
    """
    merged = base.copy()
    for key, value in override.items():
        if key in merged and isinstance(merged[key], dict) and isinstance(value, dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _load_yaml(path: Path) -> dict[str, Any]:
    """Load a YAML file, returning an empty dict if it doesn't exist or is empty."""
    if not path.exists():
        return {}
    with open(path) as f:
        data = yaml.safe_load(f)
    return data if isinstance(data, dict) else {}


def load_config(project_dir: Path | None = None) -> CodeYConfig:
    """Load and validate the CODE-Y configuration.

    Merge order (later overrides earlier):
      1. Embedded default_config.yaml
      2. ~/.codey/config.yaml      (global user overrides)
      3. <project>/.codey.yaml     (project-level overrides)

    Returns a validated CodeYConfig instance.
    """
    # 1. Embedded defaults
    defaults = _load_yaml(DEFAULT_CONFIG_PATH)

    # 2. Global user config
    global_cfg = _load_yaml(GLOBAL_CONFIG_FILE)

    # 3. Project-level config
    project_cfg: dict[str, Any] = {}
    if project_dir is not None:
        project_path = project_dir / PROJECT_CONFIG_FILE
        project_cfg = _load_yaml(project_path)
    else:
        # Try CWD
        cwd_project = Path.cwd() / PROJECT_CONFIG_FILE
        project_cfg = _load_yaml(cwd_project)

    # Merge: defaults <- global <- project
    merged = _deep_merge(defaults, global_cfg)
    merged = _deep_merge(merged, project_cfg)

    return CodeYConfig.model_validate(merged)


def ensure_global_config_dir() -> Path:
    """Create ~/.codey/ directory if it doesn't exist. Returns the path."""
    GLOBAL_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    return GLOBAL_CONFIG_DIR


def resolve_api_key(provider_name: str, api_key_env: str | None) -> str | None:
    """Resolve an API key from the environment variable specified in config."""
    if api_key_env is None:
        return None
    key = os.environ.get(api_key_env)
    if key is None:
        return None
    return key

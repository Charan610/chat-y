"""Plugin loader — discovers and loads plugins from ~/.codey/plugins/.

Plugins extend CODE-Y with custom tools, slash commands, and
system prompt fragments.
"""

from __future__ import annotations

import importlib.util
import logging
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml

from codey.config.schema import CodeYConfig
from codey.plugins.plugin_spec import PluginInterface, PluginManifest
from codey.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

PLUGINS_DIR = Path.home() / ".codey" / "plugins"


class LoadedPlugin:
    """A successfully loaded plugin."""

    def __init__(self, manifest: PluginManifest, path: Path, module: Any) -> None:
        self.manifest = manifest
        self.path = path
        self.module = module


class PluginLoader:
    """Discovers and loads plugins from the plugins directory."""

    def __init__(self, tool_registry: ToolRegistry, config: CodeYConfig) -> None:
        self.tool_registry = tool_registry
        self.config = config
        self.loaded_plugins: dict[str, LoadedPlugin] = {}

    def discover_and_load(self) -> list[LoadedPlugin]:
        """Discover all plugins and load them.

        Returns list of successfully loaded plugins.
        """
        if not PLUGINS_DIR.exists():
            logger.debug("Plugins directory does not exist: %s", PLUGINS_DIR)
            return []

        loaded = []
        for plugin_dir in sorted(PLUGINS_DIR.iterdir()):
            if not plugin_dir.is_dir():
                continue

            manifest_path = plugin_dir / "plugin.yaml"
            if not manifest_path.exists():
                logger.warning("Plugin '%s' missing plugin.yaml, skipping", plugin_dir.name)
                continue

            try:
                plugin = self._load_plugin(plugin_dir, manifest_path)
                if plugin:
                    loaded.append(plugin)
                    self.loaded_plugins[plugin.manifest.name] = plugin
            except Exception as e:
                logger.error("Failed to load plugin '%s': %s", plugin_dir.name, e)

        if loaded:
            logger.info(
                "Loaded %d plugin(s): %s",
                len(loaded),
                [p.manifest.name for p in loaded],
            )

        return loaded

    def _load_plugin(self, plugin_dir: Path, manifest_path: Path) -> LoadedPlugin | None:
        """Load a single plugin from its directory."""
        # Parse manifest
        with open(manifest_path) as f:
            raw = yaml.safe_load(f)
        if not raw:
            logger.warning("Empty plugin.yaml in %s", plugin_dir)
            return None

        manifest = PluginManifest.model_validate(raw)

        # Import the entrypoint module
        entrypoint_path = plugin_dir / f"{manifest.entrypoint}.py"
        if not entrypoint_path.exists():
            # Try as a package
            entrypoint_path = plugin_dir / manifest.entrypoint / "__init__.py"
            if not entrypoint_path.exists():
                logger.error(
                    "Plugin '%s' entrypoint not found: %s",
                    manifest.name,
                    manifest.entrypoint,
                )
                return None

        module = self._import_module(manifest.name, entrypoint_path)
        if module is None:
            return None

        # Verify the module has a register function
        if not hasattr(module, "register"):
            logger.error("Plugin '%s' module has no register() function", manifest.name)
            return None

        # Call register
        try:
            module.register(self.tool_registry, self.config)
            logger.info("Plugin '%s' v%s registered successfully", manifest.name, manifest.version)
        except Exception as e:
            logger.error("Plugin '%s' register() failed: %s", manifest.name, e)
            return None

        return LoadedPlugin(manifest=manifest, path=plugin_dir, module=module)

    @staticmethod
    def _import_module(name: str, path: Path) -> Any | None:
        """Dynamically import a Python module from a file path."""
        try:
            spec = importlib.util.spec_from_file_location(f"codey_plugin_{name}", str(path))
            if spec is None or spec.loader is None:
                logger.error("Could not create module spec for plugin '%s'", name)
                return None

            module = importlib.util.module_from_spec(spec)
            sys.modules[f"codey_plugin_{name}"] = module
            spec.loader.exec_module(module)
            return module
        except Exception as e:
            logger.error("Failed to import plugin '%s': %s", name, e)
            return None

    def get_system_prompt_fragments(self) -> list[str]:
        """Collect system prompt fragments from all loaded plugins."""
        fragments = []
        for plugin in self.loaded_plugins.values():
            if plugin.manifest.system_prompt_fragment:
                fragments.append(plugin.manifest.system_prompt_fragment)
        return fragments

    def list_plugins(self) -> list[dict[str, Any]]:
        """List all loaded plugins with metadata."""
        return [
            {
                "name": p.manifest.name,
                "version": p.manifest.version,
                "description": p.manifest.description,
                "path": str(p.path),
                "tools_added": [
                    t for t in self.tool_registry.list_tools()
                    # Heuristic: tools added by this plugin
                ],
            }
            for p in self.loaded_plugins.values()
        ]


def install_plugin(source: str) -> bool:
    """Install a plugin from a local path or git URL.

    Args:
        source: Local directory path or git clone URL.

    Returns:
        True if installation succeeded.
    """
    PLUGINS_DIR.mkdir(parents=True, exist_ok=True)

    source_path = Path(source)

    if source_path.exists() and source_path.is_dir():
        # Local directory — copy
        manifest = source_path / "plugin.yaml"
        if not manifest.exists():
            logger.error("Source directory has no plugin.yaml: %s", source)
            return False

        with open(manifest) as f:
            raw = yaml.safe_load(f)
        name = raw.get("name", source_path.name)

        dest = PLUGINS_DIR / name
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(source_path, dest)
        logger.info("Installed plugin '%s' from local path", name)
        return True

    elif source.startswith(("http://", "https://", "git@")):
        # Git URL — clone
        name = Path(source).stem.replace(".git", "")
        dest = PLUGINS_DIR / name

        if dest.exists():
            shutil.rmtree(dest)

        try:
            subprocess.run(
                ["git", "clone", source, str(dest)],
                capture_output=True,
                text=True,
                check=True,
                timeout=60,
            )
            logger.info("Installed plugin '%s' from git", name)
            return True
        except subprocess.CalledProcessError as e:
            logger.error("Git clone failed: %s", e.stderr)
            return False

    else:
        logger.error("Invalid plugin source: %s (expected local path or git URL)", source)
        return False

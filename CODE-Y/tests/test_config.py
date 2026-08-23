"""Tests for configuration loading and validation."""

from pathlib import Path
from codey.config.loader import load_config
from codey.config.schema import CodeYConfig, ProviderConfig, RoutingConfig


def test_load_default_config():
    cfg = load_config()
    assert isinstance(cfg, CodeYConfig)
    assert "nim" in cfg.providers
    assert "groq" in cfg.providers
    assert "gemini" in cfg.providers
    assert "local" in cfg.providers
    assert len(cfg.routing.default_chain) > 0


def test_resolve_model():
    cfg = load_config()
    model_id, p_cfg = cfg.resolve_model("nim_deepseek_v4")
    assert model_id == "deepseek-ai/deepseek-v4"
    assert p_cfg.base_url == "https://integrate.api.nvidia.com/v1"


def test_resolve_provider_for_alias():
    cfg = load_config()
    assert cfg.resolve_provider_for_alias("nim_deepseek_v4") == "nim"
    assert cfg.resolve_provider_for_alias("groq_llama_3_3_70b") == "groq"
    assert cfg.resolve_provider_for_alias("gemini_2_5_pro") == "gemini"
    assert cfg.resolve_provider_for_alias("local_ollama") == "local"

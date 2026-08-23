"""Tests for UI components (SlashCommandPalette, ThoughtStream summaries, StatusLine)."""

import pytest
from codey.agent.slash_commands import create_default_registry
from codey.ui.widgets.slash_command_palette import SlashCommandPalette
from codey.ui.widgets.thought_stream import ThoughtStream
from codey.ui.app import CodeYApp
from codey.config.loader import load_config
from pathlib import Path


def test_slash_command_palette_filtering():
    reg = create_default_registry()
    palette = SlashCommandPalette(registry=reg)

    # Empty query closes palette
    assert palette.filter_commands("") is False
    assert palette.is_open is False

    # Leading slash opens palette
    assert palette.filter_commands("/") is True
    assert palette.is_open is True

    # Filtering by '/mod' finds /model
    assert palette.filter_commands("/mod") is True
    sel = palette.get_selected()
    assert sel is not None
    assert sel.name == "/model"

    # Typing past command with space closes palette
    assert palette.filter_commands("/model my_alias") is False
    assert palette.is_open is False


def test_slash_command_palette_navigation():
    reg = create_default_registry()
    palette = SlashCommandPalette(registry=reg)
    palette.filter_commands("/")

    initial_sel = palette.get_selected()
    assert palette.selected_index == 0

    palette.move_down()
    assert palette.selected_index == 1
    next_sel = palette.get_selected()
    assert next_sel != initial_sel

    palette.move_up()
    assert palette.selected_index == 0


def test_thought_stream_tool_intent_formatting():
    intent = ThoughtStream._format_tool_intent("read_file", {"path": "auth.py", "start_line": 1, "end_line": 50})
    assert "reading auth.py (lines 1-50)" in intent

    shell_intent = ThoughtStream._format_tool_intent("run_command", {"command": "pytest"})
    assert "running pytest" in shell_intent


def test_thought_stream_collapsed_summary():
    raw_read = "── auth.py (1-42 of 42 lines) ──\n" + "\n".join(f"{i} | line" for i in range(42))
    summary = ThoughtStream._generate_collapsed_summary("read_file", {"path": "auth.py"}, raw_read, is_error=False)
    assert "read auth.py (42 lines)" in summary

    raw_test = "[✓ exit=0] $ pytest\n... 12 passed, 0 failed in 0.5s"
    test_summary = ThoughtStream._generate_collapsed_summary("run_command", {"command": "pytest"}, raw_test, is_error=False)
    assert "ran pytest — 12 passed" in test_summary

    err_summary = ThoughtStream._generate_collapsed_summary("read_file", {"path": "missing.py"}, "Error: File not found", is_error=True)
    assert "failed read_file: Error" in err_summary


@pytest.mark.asyncio
async def test_full_textual_app_slash_autocomplete(tmp_path: Path):
    config = load_config()
    app = CodeYApp(config=config, project_root=tmp_path)

    async with app.run_test() as pilot:
        input_bar = app.query_one("InputBar")
        input_widget = input_bar.query_one("#user-input")
        palette = input_bar.palette

        input_widget.focus()
        assert not palette.is_open

        # Type '/'
        await pilot.press("/")
        await pilot.pause()
        assert palette.is_open
        assert len(palette._filtered_commands) == 8

        # Type 'mo'
        await pilot.press("m")
        await pilot.press("o")
        await pilot.pause()
        assert palette.is_open
        assert palette.get_selected().name == "/model"

        # Press Tab
        await pilot.press("tab")
        await pilot.pause()
        assert input_widget.value == "/model "
        assert not palette.is_open

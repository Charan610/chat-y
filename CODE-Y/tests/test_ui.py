"""Tests for UI components (SlashCommandPalette, ThoughtStream summaries, StatusLine)."""

from codey.agent.slash_commands import create_default_registry
from codey.ui.widgets.slash_command_palette import SlashCommandPalette
from codey.ui.widgets.thought_stream import ThoughtStream, ToolExecutionRecord


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
    # Read file intent
    intent = ThoughtStream._format_tool_intent("read_file", {"path": "auth.py", "start_line": 1, "end_line": 50})
    assert "reading auth.py (lines 1-50)" in intent

    # Shell intent
    shell_intent = ThoughtStream._format_tool_intent("run_command", {"command": "pytest"})
    assert "running pytest" in shell_intent


def test_thought_stream_collapsed_summary():
    # Read file summary
    raw_read = "── auth.py (1-42 of 42 lines) ──\n" + "\n".join(f"{i} | line" for i in range(42))
    summary = ThoughtStream._generate_collapsed_summary("read_file", {"path": "auth.py"}, raw_read, is_error=False)
    assert "read auth.py (42 lines)" in summary

    # Run command summary with tests
    raw_test = "[✓ exit=0] $ pytest\n... 12 passed, 0 failed in 0.5s"
    test_summary = ThoughtStream._generate_collapsed_summary("run_command", {"command": "pytest"}, raw_test, is_error=False)
    assert "ran pytest — 12 passed" in test_summary

    # Error summary
    err_summary = ThoughtStream._generate_collapsed_summary("read_file", {"path": "missing.py"}, "Error: File not found", is_error=True)
    assert "failed read_file: Error" in err_summary

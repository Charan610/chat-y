"""Tests for UI components (HeaderBar, GreetingArea, ActivityFeed, SlashCommandPalette, FooterKeybar)."""

import pytest
from pathlib import Path
from codey.agent.slash_commands import create_default_registry
from codey.ui.widgets.slash_command_palette import SlashCommandPalette
from codey.ui.widgets.activity_feed import ActivityFeed
from codey.ui.widgets.greeting_area import GreetingArea
from codey.ui.widgets.header_bar import HeaderBar
from codey.ui.widgets.footer_keybar import FooterKeybar
from codey.ui.app import CodeYApp
from codey.config.loader import load_config


def test_header_bar_status_updates():
    header = HeaderBar()
    assert header.status == "online"

    header.set_retrying()
    assert header.status == "retrying"

    header.set_offline()
    assert header.status == "offline"

    header.set_online()
    assert header.status == "online"


def test_greeting_area_task_switching():
    greeting = GreetingArea(user_name="Charan")
    assert greeting.user_name == "Charan"
    assert greeting.active_task == ""

    greeting.set_task("Build a React dashboard")
    assert greeting.active_task == "Build a React dashboard"

    greeting.clear_task()
    assert greeting.active_task == ""


def test_activity_feed_action_classification():
    assert ActivityFeed._classify_action("search_code") == "Search"
    assert ActivityFeed._classify_action("read_file") == "Read"
    assert ActivityFeed._classify_action("write_file") == "Write"
    assert ActivityFeed._classify_action("edit_file") == "Edit"
    assert ActivityFeed._classify_action("run_command") == "Execute"
    assert ActivityFeed._classify_action("git_status") == "Git"
    assert ActivityFeed._classify_action("mcp_custom_tool") == "MCP"


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
    assert "/model" in sel.value

    # Subcommand filtering for models
    assert palette.filter_commands("/model ") is True
    assert palette._mode == "models"
    assert len(palette._suggestions) > 0


@pytest.mark.asyncio
async def test_full_boxed_textual_app(tmp_path: Path):
    config = load_config()
    app = CodeYApp(config=config, project_root=tmp_path)

    async with app.run_test() as pilot:
        header = app.query_one(HeaderBar)
        greeting = app.query_one(GreetingArea)
        input_bar = app.query_one("InputBar")
        input_widget = input_bar.query_one("#user-input")
        palette = input_bar.palette
        feed = app.query_one(ActivityFeed)
        footer = app.query_one(FooterKeybar)

        assert header is not None
        assert greeting is not None
        assert feed is not None
        assert footer is not None

        # Test slash command autocomplete in boxed layout
        input_widget.focus()
        await pilot.press("/")
        await pilot.pause()
        assert palette.is_open
        assert len(palette._suggestions) == 9

        await pilot.press("m")
        await pilot.press("o")
        await pilot.pause()
        assert palette.is_open
        assert "/model" in palette.get_selected().value

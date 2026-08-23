"""Tests for SlashCommandRegistry and autocomplete filtering."""

from codey.agent.slash_commands import SlashCommand, SlashCommandRegistry, create_default_registry


def test_registry_registration_and_get():
    reg = SlashCommandRegistry()
    cmd = SlashCommand(name="/test", usage="/test <arg>", description="A test command", aliases=["/t"])
    reg.register(cmd)

    assert reg.get("/test") == cmd
    assert reg.get("/TEST") == cmd
    assert reg.get("/t") == cmd
    assert reg.get("/nonexistent") is None


def test_registry_filtering_all():
    reg = create_default_registry()
    all_cmds = reg.list_commands()

    # Typing '/' alone returns all commands
    filtered = reg.filter("/")
    assert len(filtered) == len(all_cmds)


def test_registry_filtering_prefix():
    reg = create_default_registry()

    # Prefix match on '/mod' -> '/model'
    matches = reg.filter("/mod")
    assert len(matches) >= 1
    assert matches[0].name == "/model"

    # Match on '/c' -> '/context', '/clear'
    c_matches = [m.name for m in reg.filter("/c")]
    assert "/context" in c_matches
    assert "/clear" in c_matches


def test_registry_filtering_description_match():
    reg = create_default_registry()

    # Match on 'provider' -> matches /model description
    matches = [m.name for m in reg.filter("/provider")]
    assert "/model" in matches


def test_data_driven_registration_shows_in_autocomplete():
    reg = create_default_registry()
    new_cmd = SlashCommand(
        name="/custom",
        usage="/custom",
        description="Custom extension command",
    )
    reg.register(new_cmd)

    # Immediately visible in filter
    assert new_cmd in reg.filter("/cust")
    assert new_cmd in reg.filter("/")

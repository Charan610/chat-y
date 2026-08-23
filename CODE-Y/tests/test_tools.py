"""Tests for native tools and tool registry."""

import pytest
from pathlib import Path
from codey.tools.fs_tools import create_fs_tools, ReadFileTool, WriteFileTool, EditFileTool, ListDirectoryTool
from codey.tools.shell_tool import ShellTool
from codey.tools.registry import ToolRegistry


@pytest.mark.asyncio
async def test_fs_tools(tmp_path: Path):
    registry = ToolRegistry()
    registry.register_many(create_fs_tools(tmp_path))

    # Write file
    write_res = await registry.execute("write_file", {"path": "hello.txt", "content": "Hello World\nLine 2"})
    assert "Successfully wrote" in write_res
    assert (tmp_path / "hello.txt").exists()

    # Read file
    read_res = await registry.execute("read_file", {"path": "hello.txt"})
    assert "Hello World" in read_res
    assert "Line 2" in read_res

    # Edit file
    edit_res = await registry.execute("edit_file", {"path": "hello.txt", "old_content": "Line 2", "new_content": "Line Two"})
    assert "Edited" in edit_res
    content = (tmp_path / "hello.txt").read_text()
    assert "Line Two" in content

    # List directory
    list_res = await registry.execute("list_directory", {"path": "."})
    assert "hello.txt" in list_res


@pytest.mark.asyncio
async def test_shell_tool(tmp_path: Path):
    shell = ShellTool(project_root=tmp_path, shell_allowlist=["echo", "ls"], auto_approve_shell=False)
    assert shell.is_auto_approved("echo 'hi'") is True
    assert shell.is_auto_approved("rm -rf foo") is False

    res = await shell.execute(command="echo 'test output'")
    assert "exit=0" in res
    assert "test output" in res

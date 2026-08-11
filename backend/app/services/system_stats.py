import subprocess
import re
import shutil
import platform
from datetime import datetime

class SystemStatsService:
    def get_stats(self) -> dict:
        """Fetch system statistics on macOS, with fallback for other OSs."""
        is_mac = platform.system() == "Darwin"

        battery = 100
        charging = False
        ram_free = 4.0
        disk_free = "120 GB"
        disk_total = "500 GB"
        uptime = "1d 0h 0m"

        # 1. Disk Usage (shutil works everywhere)
        try:
            total, used, free = shutil.disk_usage("/")
            disk_free = f"{free / (1024**3):.1f} GB"
            disk_total = f"{total / (1024**3):.1f} GB"
        except Exception:
            pass

        if is_mac:
            # 2. Battery
            try:
                out = subprocess.check_output(["pmset", "-g", "batt"]).decode("utf-8")
                m_pct = re.search(r"(\d+)%", out)
                if m_pct:
                    battery = int(m_pct.group(1))
                charging = "charging" in out or "AC Power" in out
            except Exception:
                battery = 100
                charging = True

            # 3. RAM (macOS vm_stat)
            try:
                # Total memory
                memsize_out = subprocess.check_output(["sysctl", "-n", "hw.memsize"]).decode("utf-8").strip()
                total_bytes = int(memsize_out)
                total_gb = total_bytes / (1024**3)

                # Free memory via vm_stat
                vm_out = subprocess.check_output(["vm_stat"]).decode("utf-8")
                page_size_match = re.search(r"page size of (\d+) bytes", vm_out)
                page_size = 4096
                if page_size_match:
                    page_size = int(page_size_match.group(1))

                free_pages_match = re.search(r"Pages free:\s+(\d+)", vm_out)
                inactive_pages_match = re.search(r"Pages inactive:\s+(\d+)", vm_out)
                
                free_pages = 0
                inactive_pages = 0
                if free_pages_match:
                    free_pages = int(free_pages_match.group(1))
                if inactive_pages_match:
                    inactive_pages = int(inactive_pages_match.group(1))

                # In macOS, free + inactive pages are generally available to apps
                available_bytes = (free_pages + inactive_pages) * page_size
                ram_free = round(available_bytes / (1024**3), 1)
            except Exception:
                ram_free = 4.0

            # 4. Uptime
            try:
                # Output format: "16:21  up 2 days, 14:12, 2 users, ..."
                out = subprocess.check_output(["uptime"]).decode("utf-8")
                match = re.search(r"up\s+(.*?),\s+\d+\s+user", out)
                if match:
                    uptime = match.group(1).strip()
                else:
                    # Alternative regex if user segment is different
                    match2 = re.search(r"up\s+(.*?),\s+load", out)
                    if match2:
                        uptime = match2.group(1).strip()
            except Exception:
                uptime = "unknown"
        else:
            # Fallbacks for non-mac environments
            battery = 100
            charging = True
            ram_free = 8.0
            uptime = "running"

        return {
            "battery": battery,
            "charging": charging,
            "ram_free_gb": ram_free,
            "disk_free": disk_free,
            "disk_total": disk_total,
            "uptime": uptime,
        }

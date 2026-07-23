"""Devin CLI ACP provider profile.

devin-acp uses an external ACP subprocess (`devin acp`) — same transport
path as copilot-acp. Core runtime/auth wiring lives in hermes_cli +
agent.copilot_acp_client; this profile registers catalog metadata.
"""

from providers import register_provider
from providers.base import ProviderProfile


class DevinACPProfile(ProviderProfile):
    """Devin CLI ACP — external process, no REST models endpoint."""

    def fetch_models(
        self,
        *,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float = 8.0,
    ) -> list[str] | None:
        """Prefer live `devin models list --format json`."""
        try:
            from hermes_cli.models import _fetch_devin_cli_models

            return _fetch_devin_cli_models(timeout=timeout)
        except Exception:
            return None


devin_acp = DevinACPProfile(
    name="devin-acp",
    aliases=("devin", "devin-cli", "devin-acp-agent"),
    display_name="Devin CLI",
    description="Devin CLI via ACP subprocess (devin acp)",
    api_mode="chat_completions",
    env_vars=(),  # Managed by ACP subprocess / local CLI login
    base_url="acp://devin",
    auth_type="external_process",
)

register_provider(devin_acp)

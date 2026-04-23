from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    app_env: str = "development"
    app_name: str = "CRM Bradata"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 1440

    database_url: str = "postgresql+psycopg2://crm:crm@localhost:5432/crm_bradata"

    pncp_base_url: str = "https://pncp.gov.br"
    pncp_request_timeout: int = 30
    pncp_request_delay_ms: int = 300

    cnpj_ws_base_url: str = "https://publica.cnpj.ws/cnpj"
    cnpj_ws_token: str = ""
    cnpj_ws_request_delay_ms: int = 1500

    icp_min_faturamento: float = 120_000_000.0
    icp_cnaes_ti: str = "6201500,6202300,6203100,6204000,6209100,6311900,6319400"

    scheduler_enabled: bool = True
    pncp_daily_cron_hour: int = 3
    pncp_daily_cron_minute: int = 0

    default_admin_email: str = "admin@bradata.com.br"
    default_admin_password: str = "ChangeMe!2026"

    ai_provider: str = "deepseek"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    # Financeiro / analytics
    commission_rate_percent: float = 10.0    # % do valor de deals ganhos
    cac_mensal: float = 5000.0               # custo de aquisição médio mensal (R$)
    ltv_meses_retencao: float = 18.0         # retenção média em meses (proxy LTV)

    @property
    def icp_cnaes_ti_list(self) -> list[str]:
        return [c.strip() for c in self.icp_cnaes_ti.split(",") if c.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

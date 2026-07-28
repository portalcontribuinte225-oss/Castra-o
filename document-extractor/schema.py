"""Schema de extração — edite os campos abaixo para o seu formulário."""

from pydantic import BaseModel, Field


class ExtractionSchema(BaseModel):
    """Campos a extrair de cada documento. Adapte livremente."""

    nome: str = Field(description="Nome completo da pessoa no documento")
    cpf: str = Field(description="CPF, apenas dígitos, sem pontuação")
    data: str = Field(description="Data principal do documento, formato AAAA-MM-DD")
    endereco: str = Field(description="Endereço completo, se presente no documento")

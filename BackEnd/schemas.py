from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from models import TipoRecurso, StatusRecurso, GravidadeIncidente, StatusIncidente

class UsuarioBase(BaseModel):
    username: str
    nome: str
    email: str
    cargo: Optional[str] = None
    role: str

class UsuarioCreate(UsuarioBase):
    senha: str

class Usuario(UsuarioBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class RecursoBase(BaseModel):
    tipo: TipoRecurso
    nome: str
    status: StatusRecurso
    localizacao: str

class RecursoCreate(RecursoBase):
    pass

class Recurso(RecursoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    criado_por: int

    class Config:
        from_attributes = True

class IncidenteBase(BaseModel):
    titulo: str
    gravidade: GravidadeIncidente
    status: StatusIncidente
    descricao: Optional[str] = None
    recurso_id: Optional[int] = None

class IncidenteCreate(IncidenteBase):
    pass

class Incidente(IncidenteBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    criado_por: int

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_recursos: int = Field(..., description="Total de recursos cadastrados")
    recursos_ativos: int = Field(..., description="Total de recursos ativos")
    total_incidentes: int = Field(..., description="Total de incidentes")
    incidentes_abertos: int = Field(..., description="Incidentes não resolvidos")
    cameras_ativas: int = Field(..., description="Câmeras ativas")
    status_sistema: str = Field(..., description="Status geral do sistema")
from sqlalchemy import Column, Integer, String, Enum, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base
import enum

class TipoRecurso(str, enum.Enum):
    EQUIPAMENTO = "Equipamento"
    VEICULO = "Veículo"
    DISPOSITIVO = "Dispositivo"

class StatusRecurso(str, enum.Enum):
    ATIVO = "Ativo"
    INATIVO = "Inativo"
    MANUTENCAO = "Manutenção"

class GravidadeIncidente(str, enum.Enum):
    BAIXA = "Baixa"
    MEDIA = "Média"
    ALTA = "Alta"
    CRITICA = "Crítica"

class StatusIncidente(str, enum.Enum):
    ABERTO = "Aberto"
    EM_ANDAMENTO = "Em Andamento"
    RESOLVIDO = "Resolvido"

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    senha_hash = Column(String)
    nome = Column(String)
    email = Column(String, unique=True)
    cargo = Column(String, nullable=True)
    role = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Recurso(Base):
    __tablename__ = "recursos"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(Enum(TipoRecurso))
    nome = Column(String, index=True)
    status = Column(Enum(StatusRecurso))
    localizacao = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_por = Column(Integer, ForeignKey("usuarios.id"))

class Incidente(Base):
    __tablename__ = "incidentes"

    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String, index=True)
    gravidade = Column(Enum(GravidadeIncidente))
    status = Column(Enum(StatusIncidente))
    descricao = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    criado_por = Column(Integer, ForeignKey("usuarios.id"))
    recurso_id = Column(Integer, ForeignKey("recursos.id"), nullable=True)

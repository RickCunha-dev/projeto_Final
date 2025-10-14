from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List
from jose import jwt
from passlib.context import CryptContext
from pathlib import Path
import os
from dotenv import load_dotenv

from database import get_db, engine, Base
import models
import schemas

# Carrega variáveis de ambiente
load_dotenv()

# Configuração de logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Inicializa o banco de dados
def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Banco de dados inicializado com sucesso")
    except Exception as e:
        logger.error(f"Erro ao inicializar banco de dados: {e}")
        raise

# Inicializa o banco de dados
init_db()

# Criação da aplicação FastAPI com configurações de erro personalizadas
app = FastAPI(
    title="Wayne Security API",
    description="API do Sistema de Segurança da Wayne Industries",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    logger.info("Iniciando a aplicação...")
    init_db()
    logger.info("Aplicação iniciada com sucesso")

# Configuração CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configurações de segurança
SECRET_KEY = os.getenv("SECRET_KEY", "wayne_industries_secret_key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Rota de verificação de saúde
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected"
    }

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Funções de autenticação
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    user = db.query(models.Usuario).filter(models.Usuario.username == username).first()
    if user is None:
        raise credentials_exception
    return user

# Rota para criar o primeiro usuário admin
@app.post("/setup-admin", response_model=dict)
async def setup_admin(db: Session = Depends(get_db)):
    try:
        # Verifica se já existe algum usuário admin
        admin = db.query(models.Usuario).filter(models.Usuario.role == "admin").first()
        if admin:
            raise HTTPException(status_code=400, detail="Já existe um usuário admin")
        
        # Cria o usuário admin
        admin_user = models.Usuario(
            username="admin",
            senha_hash=get_password_hash("admin123"),
            role="admin",
            nome="Administrador",
            email="admin@wayne.com",
            cargo="Administrador do Sistema"
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        return {"message": "Usuário admin criado com sucesso"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    return {"message": "Usuário admin criado com sucesso"}

# Rotas de autenticação
@app.post("/token", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.Usuario).filter(models.Usuario.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Rotas de recursos
@app.get("/recursos/", response_model=List[schemas.Recurso])
async def listar_recursos(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    recursos = db.query(models.Recurso).all()
    return recursos

@app.post("/recursos/", response_model=schemas.Recurso)
async def criar_recurso(
    recurso: schemas.RecursoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if current_user.role not in ["gerente", "admin"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    db_recurso = models.Recurso(**recurso.dict(), criado_por=current_user.id)
    db.add(db_recurso)
    db.commit()
    db.refresh(db_recurso)
    return db_recurso

@app.delete("/recursos/{recurso_id}")
async def remover_recurso(
    recurso_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if current_user.role not in ["gerente", "admin"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    recurso = db.query(models.Recurso).filter(models.Recurso.id == recurso_id).first()
    if not recurso:
        raise HTTPException(status_code=404, detail="Recurso não encontrado")
    
    db.delete(recurso)
    db.commit()
    return {"message": "Recurso removido com sucesso"}

# Rotas de incidentes
@app.get("/incidentes/", response_model=List[schemas.Incidente])
async def listar_incidentes(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    incidentes = db.query(models.Incidente).all()
    return incidentes

@app.post("/incidentes/", response_model=schemas.Incidente)
async def criar_incidente(
    incidente: schemas.IncidenteCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    db_incidente = models.Incidente(**incidente.dict(), criado_por=current_user.id)
    db.add(db_incidente)
    db.commit()
    db.refresh(db_incidente)
    return db_incidente

@app.delete("/incidentes/{incidente_id}")
async def remover_incidente(
    incidente_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    if current_user.role not in ["gerente", "admin"]:
        raise HTTPException(status_code=403, detail="Sem permissão")
    
    incidente = db.query(models.Incidente).filter(models.Incidente.id == incidente_id).first()
    if not incidente:
        raise HTTPException(status_code=404, detail="Incidente não encontrado")
    
    db.delete(incidente)
    db.commit()
    return {"message": "Incidente removido com sucesso"}

# Rota do dashboard
@app.get("/dashboard/stats", response_model=schemas.DashboardStats)
async def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user)
):
    total_recursos = db.query(models.Recurso).count()
    recursos_ativos = db.query(models.Recurso).filter(models.Recurso.status == "Ativo").count()
    
    total_incidentes = db.query(models.Incidente).count()
    incidentes_abertos = db.query(models.Incidente).filter(
        models.Incidente.status.in_(["Aberto", "Em Andamento"])
    ).count()
    
    cameras_ativas = db.query(models.Recurso).filter(
        models.Recurso.tipo == "Dispositivo",
        models.Recurso.status == "Ativo"
    ).count()
    
    # Determinando o status do sistema
    incidentes_criticos = db.query(models.Incidente).filter(
        models.Incidente.gravidade == "Crítica",
        models.Incidente.status != "Resolvido"
    ).count()
    
    incidentes_altos = db.query(models.Incidente).filter(
        models.Incidente.gravidade == "Alta",
        models.Incidente.status != "Resolvido"
    ).count()
    
    if incidentes_criticos > 0:
        status_sistema = "CRÍTICO"
    elif incidentes_altos > 0:
        status_sistema = "ALERTA"
    else:
        status_sistema = "NORMAL"
    
    return schemas.DashboardStats(
        total_recursos=total_recursos,
        recursos_ativos=recursos_ativos,
        total_incidentes=total_incidentes,
        incidentes_abertos=incidentes_abertos,
        cameras_ativas=cameras_ativas,
        status_sistema=status_sistema
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
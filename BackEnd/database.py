from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path

# Criando o diretório para o banco de dados se não existir
import os

# Obtém o caminho absoluto do diretório atual
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
db_dir = os.path.join(BASE_DIR, "data")

# Cria o diretório se não existir
if not os.path.exists(db_dir):
    os.makedirs(db_dir)

# Define o caminho do banco de dados
db_file = os.path.join(db_dir, "wayne_security.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{db_file}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
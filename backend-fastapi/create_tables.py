from sqlalchemy import create_engine
from app.models import Base

def main():
    sync_url = "postgresql://crm_admin:crm_dev_password_2024@localhost:5432/crm_mendonca_galvao"
    engine = create_engine(sync_url)
    Base.metadata.create_all(engine)
    print("Tables created successfully using sync engine!")

if __name__ == "__main__":
    main()

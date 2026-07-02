import os
import glob

schemas_dir = r"c:\Users\User\Documents\python_level_hard\CRM_MG\backend-fastapi\app\schemas"
files = glob.glob(os.path.join(schemas_dir, "*.py"))

for file in files:
    if file.endswith("base.py") or file.endswith("__init__.py"):
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    content = content.replace("from pydantic import BaseModel\nfrom app.schemas.base import CamelModel", "from pydantic import BaseModel")
    content = content.replace("from app.schemas.base import CamelModel, ", "from pydantic import BaseModel, ")
    content = content.replace("(CamelModel)", "(BaseModel)")
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

base_path = os.path.join(schemas_dir, "base.py")
if os.path.exists(base_path):
    os.remove(base_path)

print("Schemas reverted!")

import os
import glob

schemas_dir = r"c:\Users\User\Documents\python_level_hard\CRM_MG\backend-fastapi\app\schemas"
files = glob.glob(os.path.join(schemas_dir, "*.py"))

for file in files:
    if file.endswith("base.py") or file.endswith("__init__.py"):
        continue
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'CamelModel' in content:
        continue
        
    # Replace from pydantic import BaseModel with the new imports
    content = content.replace("from pydantic import BaseModel", "from pydantic import BaseModel\nfrom app.schemas.base import CamelModel")
    
    # Replace class X(BaseModel): with class X(CamelModel):
    # Only for the base schemas, not necessarily the Response ones that inherit from Base
    # But wait, any class inheriting from BaseModel should inherit from CamelModel instead to get the config
    content = content.replace("(BaseModel)", "(CamelModel)")
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
print("Schemas updated!")

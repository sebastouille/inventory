# Worker IFC geometry

Ce worker extrait des boites englobantes depuis un fichier IFC avec IfcOpenShell.

## Installation locale

```powershell
python -m pip install -r apps/api/workers/ifc_geometry/requirements.txt
```

Le backend appelle `extract_scene.py` comme un batch local. Il ne demarre pas de serveur Python.

## Usage manuel

```powershell
python apps/api/workers/ifc_geometry/extract_scene.py --input source.ifc --output extract.json
```

La sortie est un JSON technique interne. Le backend NestJS le transforme ensuite en `scene.v1.json`.

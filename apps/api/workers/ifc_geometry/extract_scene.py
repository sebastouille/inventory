#!/usr/bin/env python3
"""Extract simplified IFC geometry as world bounding boxes."""

from __future__ import annotations

import argparse
from contextlib import nullcontext
import json
import math
import os
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, TextIO, Tuple


Vector = List[float]
BBox = Dict[str, Vector]

SPATIAL_CLASSES = ("IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace")
PRODUCT_CLASSES = ("IfcElement",)
DEFAULT_PRODUCT_CLASSES = (
    "IfcFurniture",
    "IfcFurnishingElement",
    "IfcFlowTerminal",
    "IfcBuildingElementProxy",
    "IfcDistributionElement",
    "IfcDistributionFlowElement",
    "IfcElementAssembly",
)
IFC_CLASS_ALIASES = {
    "IFCFURNITURE": "IfcFurniture",
    "IFCFURNISHINGELEMENT": "IfcFurnishingElement",
    "IFCFLOWTERMINAL": "IfcFlowTerminal",
    "IFCBUILDINGELEMENTPROXY": "IfcBuildingElementProxy",
    "IFCDISTRIBUTIONELEMENT": "IfcDistributionElement",
    "IFCDISTRIBUTIONFLOWELEMENT": "IfcDistributionFlowElement",
    "IFCELEMENTASSEMBLY": "IfcElementAssembly",
    "IFCELEMENT": "IfcElement",
}


def log(level: str, step: str, message: str, **metadata: Any) -> None:
    payload = {
        "level": level,
        "step": step,
        "message": message,
        "metadata": metadata,
    }
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def entity_id(entity: Any) -> Optional[int]:
    try:
        return int(entity.id())
    except Exception:
        return None


def safe_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def bbox_from_vertices(vertices: Iterable[float]) -> Optional[BBox]:
    iterator = iter(vertices)
    min_x = min_y = min_z = math.inf
    max_x = max_y = max_z = -math.inf
    count = 0
    while True:
        try:
            x = float(next(iterator))
            y = float(next(iterator))
            z = float(next(iterator))
        except StopIteration:
            break
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
            continue
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        min_z = min(min_z, z)
        max_x = max(max_x, x)
        max_y = max(max_y, y)
        max_z = max(max_z, z)
        count += 1

    if count == 0:
        return None

    return {
        "min": [min_x, min_y, min_z],
        "max": [max_x, max_y, max_z],
    }


def bbox_and_shape_parts_from_vertices(vertices: Iterable[float], max_shape_parts: int) -> Tuple[Optional[BBox], List[BBox]]:
    values = list(vertices)
    bbox = bbox_from_vertices(values)
    if bbox is None or max_shape_parts <= 1:
        return bbox, []

    size = bbox_size(bbox)
    axis = max(range(3), key=lambda index: size[index])
    bins = max(1, min(max_shape_parts, 24))
    axis_min = bbox["min"][axis]
    axis_max = bbox["max"][axis]
    axis_size = axis_max - axis_min
    if axis_size <= 0:
        return bbox, []

    grouped: List[Optional[BBox]] = [None for _ in range(bins)]
    for index in range(0, len(values) - 2, 3):
        point = [float(values[index]), float(values[index + 1]), float(values[index + 2])]
        if not all(math.isfinite(value) for value in point):
            continue
        bucket = min(bins - 1, max(0, int(((point[axis] - axis_min) / axis_size) * bins)))
        point_bbox: BBox = {"min": point, "max": point}
        grouped[bucket] = merge_bbox(grouped[bucket], point_bbox)

    parts = [part for part in grouped if part is not None]
    return bbox, parts[:max_shape_parts]


def bbox_center(bbox: BBox) -> Vector:
    return [
        (bbox["min"][0] + bbox["max"][0]) / 2,
        (bbox["min"][1] + bbox["max"][1]) / 2,
        (bbox["min"][2] + bbox["max"][2]) / 2,
    ]


def bbox_size(bbox: BBox) -> Vector:
    return [
        max(0.0, bbox["max"][0] - bbox["min"][0]),
        max(0.0, bbox["max"][1] - bbox["min"][1]),
        max(0.0, bbox["max"][2] - bbox["min"][2]),
    ]


def merge_bbox(left: Optional[BBox], right: Optional[BBox]) -> Optional[BBox]:
    if left is None:
        return right
    if right is None:
        return left
    return {
        "min": [
            min(left["min"][0], right["min"][0]),
            min(left["min"][1], right["min"][1]),
            min(left["min"][2], right["min"][2]),
        ],
        "max": [
            max(left["max"][0], right["max"][0]),
            max(left["max"][1], right["max"][1]),
            max(left["max"][2], right["max"][2]),
        ],
    }


def get_schema(model: Any) -> str:
    try:
        schema = model.schema
        if callable(schema):
            return str(schema())
        return str(schema)
    except Exception:
        return "UNKNOWN"


def get_unit_scale(model: Any) -> float:
    try:
        import ifcopenshell.util.unit  # type: ignore

        scale = ifcopenshell.util.unit.calculate_unit_scale(model)
        return float(scale) if scale else 1.0
    except Exception:
        return 1.0


def get_parent_global_id(entity: Any) -> Optional[str]:
    try:
        for rel in getattr(entity, "Decomposes", []) or []:
            parent = getattr(rel, "RelatingObject", None)
            if parent is not None and getattr(parent, "GlobalId", None):
                return str(parent.GlobalId)
    except Exception:
        pass
    return None


def get_storey_global_id(entity: Any) -> Optional[str]:
    try:
        for rel in getattr(entity, "ContainedInStructure", []) or []:
            parent = getattr(rel, "RelatingStructure", None)
            if parent is not None and getattr(parent, "GlobalId", None):
                return str(parent.GlobalId)
    except Exception:
        pass
    return None


def get_children_count(entity: Any) -> int:
    count = 0
    try:
        for rel in getattr(entity, "IsDecomposedBy", []) or []:
            count += len(getattr(rel, "RelatedObjects", []) or [])
    except Exception:
        return count
    return count


def make_settings() -> Any:
    import ifcopenshell.geom  # type: ignore

    settings = ifcopenshell.geom.settings()
    try:
        settings.set(settings.USE_WORLD_COORDS, True)
    except Exception:
        try:
            settings.set("use-world-coords", True)
        except Exception:
            pass
    return settings


def extract_geometry(entity: Any, settings: Any, geometry_level: str, max_shape_parts: int) -> Tuple[Optional[BBox], Optional[str], List[BBox]]:
    if geometry_level == "NONE":
        return None, None, []
    try:
        import ifcopenshell.geom  # type: ignore

        shape = ifcopenshell.geom.create_shape(settings, entity)
        geometry = getattr(shape, "geometry", None)
        vertices = getattr(geometry, "verts", None)
        if vertices is None:
            return None, "NO_VERTICES", []
        if geometry_level == "INTERMEDIATE":
            bbox, shape_parts = bbox_and_shape_parts_from_vertices(vertices, max_shape_parts)
        else:
            bbox = bbox_from_vertices(vertices)
            shape_parts = []
        if bbox is None:
            return None, "EMPTY_BBOX", []
        return bbox, None, shape_parts
    except Exception as error:
        return None, str(error), []


def serialize_entity(entity: Any, settings: Any, kind: str, geometry_level: str, max_shape_parts: int) -> Dict[str, Any]:
    bbox, error, shape_parts = extract_geometry(entity, settings, geometry_level, max_shape_parts)
    global_id = safe_string(getattr(entity, "GlobalId", None))
    name = safe_string(getattr(entity, "Name", None))
    description = safe_string(getattr(entity, "Description", None))
    item: Dict[str, Any] = {
        "globalId": global_id,
        "ifcEntityId": entity_id(entity),
        "ifcClass": entity.is_a(),
        "name": name,
        "description": description,
        "parentGlobalId": get_parent_global_id(entity),
        "storeyGlobalId": get_storey_global_id(entity),
        "bbox": bbox,
        "center": bbox_center(bbox) if bbox else None,
        "size": bbox_size(bbox) if bbox else None,
        "hasGeometry": bbox is not None,
        "geometryError": error,
    }
    if shape_parts:
        item["shapeParts"] = shape_parts
    if kind == "spatial":
        item["childrenCount"] = get_children_count(entity)
        item["elevation"] = safe_float(getattr(entity, "Elevation", None))
    return item


def set_item_bbox(item: Dict[str, Any], bbox: Optional[BBox], source: str) -> None:
    if bbox is None:
        return
    item["bbox"] = bbox
    item["center"] = bbox_center(bbox)
    item["size"] = bbox_size(bbox)
    item["hasGeometry"] = True
    item["geometryError"] = None
    item["geometrySource"] = source


def safe_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except Exception:
        return None


def entities_by_types(model: Any, class_names: Iterable[str]) -> List[Any]:
    seen: set[int] = set()
    items: List[Any] = []
    for class_name in class_names:
        try:
            for entity in model.by_type(class_name):
                identity = entity_id(entity)
                if identity is not None and identity in seen:
                    continue
                if identity is not None:
                    seen.add(identity)
                items.append(entity)
        except Exception:
            continue
    return items


def parse_class_list(value: str) -> List[str]:
    text = (value or "").strip()
    if not text:
        return list(DEFAULT_PRODUCT_CLASSES)
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [canonical_ifc_class(str(item).strip()) for item in parsed if str(item).strip()]
    except Exception:
        pass
    return [canonical_ifc_class(item.strip()) for item in text.split(",") if item.strip()]


def canonical_ifc_class(value: str) -> str:
    if not value:
        return value
    normalized = value.strip()
    alias = IFC_CLASS_ALIASES.get(normalized.upper())
    if alias:
        return alias
    if normalized.startswith("IFC") and normalized.isupper():
        return "Ifc" + "".join(part.capitalize() for part in normalized[3:].split("_"))
    return normalized


def write_ndjson_line(handle: Optional[TextIO], item: Dict[str, Any]) -> None:
    if handle is None:
        return
    handle.write(json.dumps(item, ensure_ascii=True))
    handle.write("\n")
    handle.flush()


def extract(
    input_path: str,
    max_products: int,
    selected_classes: List[str],
    geometry_level: str,
    max_shape_parts: int,
    metadata_output: Optional[str],
    geometry_output: Optional[str],
) -> Dict[str, Any]:
    import ifcopenshell  # type: ignore

    started = time.time()
    geometry_level = geometry_level.upper()
    if geometry_level not in ("NONE", "MINIMUM", "INTERMEDIATE"):
        geometry_level = "MINIMUM"
    log("INFO", "open_file", "Ouverture du fichier IFC", path=input_path)
    model = ifcopenshell.open(input_path)
    log("INFO", "open_file", "Fichier IFC ouvert", schema=get_schema(model))
    settings = make_settings()
    warnings: List[str] = []

    log("INFO", "list_spatial", "Recherche des objets spatiaux")
    spatial_entities = entities_by_types(model, SPATIAL_CLASSES)
    log(
        "INFO",
        "list_products",
        "Recherche des produits IFC",
        maxProducts=max_products,
        selectedClasses=selected_classes,
        geometryLevel=geometry_level,
    )
    product_entities = entities_by_types(model, selected_classes or DEFAULT_PRODUCT_CLASSES)
    product_entities = [
        entity
        for entity in product_entities
        if not any(entity.is_a(spatial_class) for spatial_class in SPATIAL_CLASSES)
    ][:max_products]
    log(
        "INFO",
        "list_products",
        "Objets IFC detectes",
        spatialCount=len(spatial_entities),
        productCount=len(product_entities),
    )

    spatial_objects = []
    products = []
    metadata_context = open(metadata_output, "w", encoding="utf-8") if metadata_output else nullcontext(None)
    geometry_context = open(geometry_output, "w", encoding="utf-8") if geometry_output else nullcontext(None)
    with metadata_context as metadata_handle, geometry_context as geometry_handle:
        for index, entity in enumerate(spatial_entities, start=1):
            item = serialize_entity(entity, settings, "spatial", geometry_level, max_shape_parts)
            spatial_objects.append(item)
            write_ndjson_line(metadata_handle, {"kind": "spatial", **item})
            if item.get("hasGeometry"):
                write_ndjson_line(geometry_handle, {"kind": "spatial", **item})
            if index == len(spatial_entities) or index % 50 == 0:
                log("INFO", "extract_spatial_geometry", "Extraction geometrie spatiale", processed=index, total=len(spatial_entities))

        for index, entity in enumerate(product_entities, start=1):
            item = serialize_entity(entity, settings, "product", geometry_level, max_shape_parts)
            products.append(item)
            write_ndjson_line(metadata_handle, {"kind": "product", **item})
            if item.get("hasGeometry"):
                write_ndjson_line(geometry_handle, {"kind": "product", **item})
            if index == len(product_entities) or index % 250 == 0:
                log("INFO", "extract_product_geometry", "Extraction geometrie produits", processed=index, total=len(product_entities))

    # Many IFC spatial containers have no own representation. Their usable
    # volume for this application is derived from contained products/children.
    log("INFO", "aggregate_spatial", "Agregation des volumes spatiaux")
    for item in spatial_objects:
        if item.get("hasGeometry"):
            continue
        aggregate: Optional[BBox] = None
        global_id = item.get("globalId")
        for product in products:
            if product.get("storeyGlobalId") == global_id or product.get("parentGlobalId") == global_id:
                aggregate = merge_bbox(aggregate, product.get("bbox"))
        set_item_bbox(item, aggregate, "aggregate-contained-products")

    for _ in range(6):
        changed = False
        for item in spatial_objects:
            if item.get("hasGeometry"):
                continue
            aggregate = None
            global_id = item.get("globalId")
            for child in spatial_objects:
                if child.get("parentGlobalId") == global_id:
                    aggregate = merge_bbox(aggregate, child.get("bbox"))
            before = item.get("hasGeometry")
            set_item_bbox(item, aggregate, "aggregate-child-spatial")
            changed = changed or before != item.get("hasGeometry")
        if not changed:
            break

    storeys = [
        item
        for item in spatial_objects
        if item.get("ifcClass") == "IfcBuildingStorey"
    ]

    global_bbox: Optional[BBox] = None
    for item in spatial_objects + products:
        global_bbox = merge_bbox(global_bbox, item.get("bbox"))

    product_errors = 0 if geometry_level == "NONE" else sum(1 for item in products if not item.get("hasGeometry"))
    spatial_errors = 0 if geometry_level == "NONE" else sum(1 for item in spatial_objects if not item.get("hasGeometry"))
    if product_errors:
        warnings.append(f"{product_errors} products without extractable geometry")
        log("WARNING", "diagnostics", "Produits sans geometrie exploitable", count=product_errors)
    if spatial_errors:
        warnings.append(f"{spatial_errors} spatial objects without extractable geometry")
        log("WARNING", "diagnostics", "Noeuds spatiaux sans geometrie exploitable", count=spatial_errors)

    return {
        "version": "ifcopenshell-extract-v1",
        "source": {
            "filename": os.path.basename(input_path),
            "schema": get_schema(model),
        },
        "units": {
            "lengthUnit": "METRE",
            "scaleToMeters": get_unit_scale(model),
        },
        "globalBbox": global_bbox,
        "spatialObjects": spatial_objects,
        "products": products,
        "storeys": storeys,
        "stats": {
            "geometryLevel": 0 if geometry_level == "NONE" else 1 if geometry_level == "MINIMUM" else 2,
            "totalSpatialObjects": len(spatial_objects),
            "spatialWithGeometry": len(spatial_objects) - spatial_errors,
            "spatialWithoutGeometry": spatial_errors,
            "totalProducts": len(products),
            "withGeometry": len(products) - product_errors,
            "withoutGeometry": product_errors,
            "errors": product_errors + spatial_errors,
            "durationMs": int((time.time() - started) * 1000),
        },
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract IFC world bounding boxes")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--max-products", type=int, default=5000)
    parser.add_argument("--selected-classes", default="")
    parser.add_argument("--geometry-level", default="MINIMUM")
    parser.add_argument("--max-shape-parts", type=int, default=12)
    parser.add_argument("--metadata-output")
    parser.add_argument("--geometry-output")
    args = parser.parse_args()

    try:
        result = extract(
            args.input,
            max(1, args.max_products),
            parse_class_list(args.selected_classes),
            args.geometry_level,
            max(1, args.max_shape_parts),
            args.metadata_output,
            args.geometry_output,
        )
        log("INFO", "write_output", "Ecriture du resultat d extraction", output=args.output)
        with open(args.output, "w", encoding="utf-8") as output:
            json.dump(result, output, ensure_ascii=True, indent=2)
        log("INFO", "completed", "Extraction IFC terminee", **result.get("stats", {}))
        return 0
    except Exception as error:
        error_payload = {
            "level": "ERROR",
            "step": "failed",
            "message": "Extraction IFC en erreur",
            "version": "ifcopenshell-extract-v1",
            "error": str(error),
        }
        print(json.dumps(error_payload, ensure_ascii=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

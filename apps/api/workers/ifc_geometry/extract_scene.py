#!/usr/bin/env python3
"""Extract simplified IFC geometry as world bounding boxes."""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from typing import Any, Dict, Iterable, List, Optional, Tuple


Vector = List[float]
BBox = Dict[str, Vector]

SPATIAL_CLASSES = ("IfcSite", "IfcBuilding", "IfcBuildingStorey", "IfcSpace")
PRODUCT_CLASSES = ("IfcElement",)


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
    values = list(vertices)
    if len(values) < 3:
        return None

    xs: List[float] = []
    ys: List[float] = []
    zs: List[float] = []
    for index in range(0, len(values) - 2, 3):
        x = float(values[index])
        y = float(values[index + 1])
        z = float(values[index + 2])
        if not (math.isfinite(x) and math.isfinite(y) and math.isfinite(z)):
            continue
        xs.append(x)
        ys.append(y)
        zs.append(z)

    if not xs:
        return None

    return {
        "min": [min(xs), min(ys), min(zs)],
        "max": [max(xs), max(ys), max(zs)],
    }


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


def extract_geometry(entity: Any, settings: Any) -> Tuple[Optional[BBox], Optional[str]]:
    try:
        import ifcopenshell.geom  # type: ignore

        shape = ifcopenshell.geom.create_shape(settings, entity)
        geometry = getattr(shape, "geometry", None)
        vertices = getattr(geometry, "verts", None)
        if vertices is None:
            return None, "NO_VERTICES"
        bbox = bbox_from_vertices(vertices)
        if bbox is None:
            return None, "EMPTY_BBOX"
        return bbox, None
    except Exception as error:
        return None, str(error)


def serialize_entity(entity: Any, settings: Any, kind: str) -> Dict[str, Any]:
    bbox, error = extract_geometry(entity, settings)
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


def extract(input_path: str, max_products: int) -> Dict[str, Any]:
    import ifcopenshell  # type: ignore

    started = time.time()
    model = ifcopenshell.open(input_path)
    settings = make_settings()
    warnings: List[str] = []

    spatial_entities = entities_by_types(model, SPATIAL_CLASSES)
    product_entities = entities_by_types(model, PRODUCT_CLASSES)
    product_entities = [
        entity
        for entity in product_entities
        if not any(entity.is_a(spatial_class) for spatial_class in SPATIAL_CLASSES)
    ][:max_products]

    spatial_objects = [serialize_entity(entity, settings, "spatial") for entity in spatial_entities]
    products = [serialize_entity(entity, settings, "product") for entity in product_entities]

    # Many IFC spatial containers have no own representation. Their usable
    # volume for this application is derived from contained products/children.
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

    product_errors = sum(1 for item in products if not item.get("hasGeometry"))
    spatial_errors = sum(1 for item in spatial_objects if not item.get("hasGeometry"))
    if product_errors:
        warnings.append(f"{product_errors} products without extractable geometry")
    if spatial_errors:
        warnings.append(f"{spatial_errors} spatial objects without extractable geometry")

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
    parser.add_argument("--max-products", type=int, default=20000)
    args = parser.parse_args()

    try:
        result = extract(args.input, max(1, args.max_products))
        with open(args.output, "w", encoding="utf-8") as output:
            json.dump(result, output, ensure_ascii=True, indent=2)
        return 0
    except Exception as error:
        error_payload = {
            "version": "ifcopenshell-extract-v1",
            "error": str(error),
        }
        print(json.dumps(error_payload, ensure_ascii=True), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

from app.content_layout.models import BBox, LayoutCandidate, ResolvedContentBlock


class ReadingOrderResolver:
    """Resolve deterministic top-left page order with basic column awareness."""

    TABLE_OVERLAP_THRESHOLD = 0.65
    FULL_WIDTH_RATIO = 0.65

    def resolve_page(
        self,
        candidates: list[LayoutCandidate],
    ) -> tuple[list[ResolvedContentBlock], int]:
        filtered, suppressed = self._suppress_table_text(candidates)
        ordered = self._attach_image_text(self._order(filtered))
        return [
            ResolvedContentBlock(**candidate.__dict__, block_order=index)
            for index, candidate in enumerate(ordered)
        ], suppressed

    def _suppress_table_text(
        self, candidates: list[LayoutCandidate]
    ) -> tuple[list[LayoutCandidate], int]:
        tables = [item for item in candidates if item.block_type == "TABLE" and item.bbox]
        kept: list[LayoutCandidate] = []
        suppressed = 0
        for candidate in candidates:
            overlapping = [table for table in tables if _overlap_fraction(candidate.bbox, table.bbox) >= self.TABLE_OVERLAP_THRESHOLD] if candidate.bbox else []
            if candidate.block_type == "TEXT" and overlapping and not _has_unique_script_fidelity(candidate, overlapping):
                suppressed += 1
                continue
            kept.append(candidate)
        return kept, suppressed
    @staticmethod
    def _attach_image_text(candidates: list[LayoutCandidate]) -> list[LayoutCandidate]:
        image_texts = [item for item in candidates if item.block_type == "IMAGE_TEXT"]
        base = [item for item in candidates if item.block_type != "IMAGE_TEXT"]
        by_parent = {
            str(item.metadata.get("parent_image_id")): item
            for item in image_texts
            if item.metadata.get("parent_image_id")
        }
        ordered: list[LayoutCandidate] = []
        attached: set[str] = set()
        for item in base:
            ordered.append(item)
            child = by_parent.get(item.source_id) if item.block_type == "IMAGE" else None
            if child:
                ordered.append(child)
                attached.add(child.source_id)
        ordered.extend(item for item in image_texts if item.source_id not in attached)
        return ordered

    def _order(self, candidates: list[LayoutCandidate]) -> list[LayoutCandidate]:
        if not candidates:
            return []
        page_width = next((item.page_width for item in candidates if item.page_width), None)
        positioned = [item for item in candidates if item.bbox]
        unpositioned = [item for item in candidates if not item.bbox]
        if not page_width or len(positioned) < 2:
            return sorted(positioned, key=_position_key) + sorted(unpositioned, key=_fallback_key)

        wide = [item for item in positioned if _width(item.bbox) >= page_width * self.FULL_WIDTH_RATIO]
        narrow = [item for item in positioned if item not in wide]
        boundaries = sorted(wide, key=_position_key)
        result: list[LayoutCandidate] = []
        remaining = list(narrow)
        for boundary in boundaries:
            boundary_y = boundary.bbox[1]
            segment = [item for item in remaining if item.bbox[1] < boundary_y]
            result.extend(self._order_segment(segment, page_width))
            segment_ids = {id(item) for item in segment}
            remaining = [item for item in remaining if id(item) not in segment_ids]
            result.append(boundary)
        result.extend(self._order_segment(remaining, page_width))
        return result + sorted(unpositioned, key=_fallback_key)

    @staticmethod
    def _order_segment(items: list[LayoutCandidate], page_width: float) -> list[LayoutCandidate]:
        left = [item for item in items if _center_x(item.bbox) < page_width / 2]
        right = [item for item in items if _center_x(item.bbox) >= page_width / 2]
        has_column_gap = (
            left and right
            and max(item.bbox[2] for item in left) + page_width * 0.02
            < min(item.bbox[0] for item in right)
        )
        if has_column_gap:
            return sorted(left, key=_position_key) + sorted(right, key=_position_key)
        return sorted(items, key=_position_key)


def _has_unique_script_fidelity(candidate: LayoutCandidate, tables: list[LayoutCandidate]) -> bool:
    """Keep native text when table reconstruction flattened script glyphs."""
    native = candidate.content_text or ""
    fidelity = {char for char in native if "\u2070" <= char <= "\u209f"}
    if not fidelity:
        return False
    reconstructed = "\n".join(table.content_text or "" for table in tables)
    return not fidelity.issubset(set(reconstructed))


def _overlap_fraction(inner: BBox, outer: BBox) -> float:
    intersection_width = max(0.0, min(inner[2], outer[2]) - max(inner[0], outer[0]))
    intersection_height = max(0.0, min(inner[3], outer[3]) - max(inner[1], outer[1]))
    area = max(0.0, _width(inner)) * max(0.0, inner[3] - inner[1])
    return (intersection_width * intersection_height) / area if area else 0.0


def _width(bbox: BBox) -> float:
    return bbox[2] - bbox[0]


def _center_x(bbox: BBox) -> float:
    return (bbox[0] + bbox[2]) / 2


def _position_key(item: LayoutCandidate) -> tuple[float, float, str, str]:
    assert item.bbox is not None
    type_order = {"IMAGE": 0, "IMAGE_TEXT": 1}.get(item.block_type, 0)
    return item.bbox[1], item.bbox[0], f"{type_order}:{item.block_type}", item.source_id


def _fallback_key(item: LayoutCandidate) -> tuple[str, str]:
    return item.block_type, item.source_id

import hashlib, re, uuid
from typing import Any
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from app.config.settings import get_settings
from app.database.postgres import get_connection

router=APIRouter(prefix="/internal/structured-extractions",tags=["internal-structured-extractions"])
SCHEMAS={key:"1.0.0" for key in ("PROCUREMENT_PURCHASE_ORDER_V1","PROCUREMENT_GRN_V1","PROCUREMENT_SUPPLIER_INVOICE_V1","PROCUREMENT_DELIVERY_NOTE_V1","PROCUREMENT_MANIFEST_V1")}
class ExtractionRequest(BaseModel):
 organizationId:str; documentId:str; schemaKey:str; schemaVersion:str; contentVersion:int=Field(ge=1)
PATTERNS={
 "poNumber":r"(?i)\b(?:purchase[ \t]+order|po)[ \t]+(?:number\b|no(?:\.|\b)|#)[ \t]*[:\-]?[ \t]*([A-Z0-9][A-Z0-9\-/]+)",
 "grnNumber":r"(?i)\b(?:grn|goods[ \t]+receipt(?:[ \t]+note)?)[ \t]+(?:number\b|no(?:\.|\b)|#)[ \t]*[:\-]?[ \t]*([A-Z0-9][A-Z0-9\-/]+)",
 "invoiceNumber":r"(?i)\binvoice[ \t]+(?:number\b|no(?:\.|\b)|#)[ \t]*[:\-]?[ \t]*([A-Z0-9][A-Z0-9\-/]+)",
 "supplierName":r"(?i)\b(?:supplier|vendor)(?:\s+name)?\s*[:\-]\s*([^\r\n|]+)", "currency":r"(?i)\bcurrency\s*[:\-]?\s*([A-Z]{3})\b",
 "orderDate":r"(?i)\b(?:order|po)\s+date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})", "receiptDate":r"(?i)\b(?:receipt|received)\s+date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})", "invoiceDate":r"(?i)\binvoice\s+date\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})",
 "quantity":r"(?i)\b(?:ordered|invoiced)?\s*quantity\s*[:\-]?\s*(\d+(?:\.\d+)?)", "receivedQuantity":r"(?i)\breceived\s+quantity\s*[:\-]?\s*(\d+(?:\.\d+)?)", "acceptedQuantity":r"(?i)\baccepted\s+quantity\s*[:\-]?\s*(\d+(?:\.\d+)?)", "damagedQuantity":r"(?i)\bdamaged\s+quantity\s*[:\-]?\s*(\d+(?:\.\d+)?)",
 "unitPrice":r"(?i)\bunit\s+price\s*[:\-]?\s*(?:INR|₹|Rs\.?\s*)?([\d,]+(?:\.\d+)?)", "taxRate":r"(?i)\btax\s+rate\s*[:\-]?\s*([\d.]+)\s*%?", "grandTotal":r"(?i)\bgrand\s+total\s*[:\-]?\s*(?:INR|₹|Rs\.?\s*)?([\d,]+(?:\.\d+)?)"}

@router.post("/run")
def run(payload:ExtractionRequest,x_internal_service_key:str=Header(default="",alias="X-Internal-Service-Key"))->dict[str,Any]:
 settings=get_settings()
 if x_internal_service_key!=settings.ai_service_internal_key: raise HTTPException(401,{"error_code":"INTERNAL_SERVICE_UNAUTHORIZED","message":"Invalid internal service key"})
 if SCHEMAS.get(payload.schemaKey)!=payload.schemaVersion: raise HTTPException(422,{"error_code":"EXTRACTION_SCHEMA_UNSUPPORTED","message":"Unsupported extraction schema"})
 with get_connection(settings.database_url) as connection:
  with connection.cursor() as cursor:
   cursor.execute("SELECT id,page_number,COALESCE(readable_text,content_text,'') text FROM document_content_blocks WHERE organization_id=%s AND document_id=%s ORDER BY page_number,block_order",(payload.organizationId,payload.documentId));blocks=cursor.fetchall()
 fields={};citations=[]
 for name,pattern in PATTERNS.items():
  found=next(((b,m) for b in blocks if (m:=re.search(pattern,b["text"]))),None)
  if not found: fields[name]={"normalizedValue":None,"displayValue":None,"confidence":0.0,"reviewRequired":True,"citationIds":[]};continue
  block,match=found;value=match.group(1).strip().rstrip(".")
  if name in {"unitPrice","grandTotal","quantity","receivedQuantity","acceptedQuantity","damagedQuantity","taxRate"}:value=value.replace(",","")
  citation_id=str(uuid.uuid4());text=block["text"];citations.append({"id":citation_id,"contentBlockId":str(block["id"]),"fieldPath":f"fields.{name}","pageNumber":block["page_number"],"textStart":match.start(),"textEnd":match.end(),"contentFingerprint":hashlib.sha256(text.encode()).hexdigest()});fields[name]={"normalizedValue":value,"displayValue":match.group(1).strip(),"confidence":0.95,"reviewRequired":False,"citationIds":[citation_id]}
 result={"documentId":payload.documentId,"schemaKey":payload.schemaKey,"schemaVersion":payload.schemaVersion,"contentVersion":payload.contentVersion,"classification":{"predictedType":payload.schemaKey,"confidence":1.0,"classifierVersion":"schema-request-v1","reviewRequired":False},"fields":fields,"lineItems":[],"validationIssues":[{"code":"FIELD_MISSING","fieldPath":f"fields.{k}","severity":"REVIEW"} for k,v in fields.items() if v["normalizedValue"] is None],"reviewRequired":any(v["reviewRequired"] for v in fields.values()),"citationIds":[c["id"] for c in citations]}
 return {"result":result,"citations":citations,"diagnostics":{"adapter":"deterministic-grounded-v1","blockCount":len(blocks)}}

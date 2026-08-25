import json

file_path = "postman_collection.json"

with open(file_path, "r", encoding="utf-8") as f:
    collection = json.load(f)

# The new prefix logic:
# Most routes are now under /eduforge/api
# Specific module prefixes:
# /auth -> /eduforge/api/auth
# /users -> /eduforge/api/users
# /organizations -> /eduforge/api/organizations
# /dashboard -> /eduforge/api/dashboard
# /students -> /eduforge/api/students/students
# /classes -> /eduforge/api/students/classes
# /enrollments -> /eduforge/api/students/enrollments
# /members -> /eduforge/api/members/members
# /roles -> /eduforge/api/members/roles
# /permissions -> /eduforge/api/members/permissions
# /enrollment -> /eduforge/api/enrollment
# /all-enrollment -> /eduforge/api/all-enrollment
# /quiz -> /eduforge/api/quiz
# /all-quiz -> /eduforge/api/all-quiz
# /api/reviews -> /eduforge/api/api/reviews

# Other routes like courses, lessons, etc., are also under /eduforge/api
# Actually, the base is now http://localhost:3000/eduforge/api for ALL routes except /health or those outside index.ts

def update_url(url_obj):
    if not url_obj or "raw" not in url_obj:
        return

    raw = url_obj["raw"]
    if "localhost:3000" not in raw:
        return

    # Extract the path part
    parts = raw.split("localhost:3000")
    if len(parts) < 2:
        return
    
    path_and_query = parts[1]
    
    # If already prefixed, skip
    if path_and_query.startswith("/eduforge/api"):
        return

    path_part = path_and_query.split("?")[0]
    
    # Check specific mappings for paths that got nested prefixes
    new_path = path_part
    
    # studentRoutes
    if path_part.startswith("/students"):
        new_path = "/students" + path_part
    elif path_part.startswith("/classes"):
        new_path = "/students" + path_part
    elif path_part.startswith("/enrollments"):
        new_path = "/students" + path_part
        
    # memberRoutes
    elif path_part.startswith("/members"):
        new_path = "/members" + path_part
    elif path_part.startswith("/roles"):
        new_path = "/members" + path_part
    elif path_part.startswith("/permissions"):
        new_path = "/members" + path_part

    # Construct the final new raw string
    final_path = "/eduforge/api" + new_path
    
    # Replace in raw
    new_raw = parts[0] + "localhost:3000" + final_path + ("?" + path_and_query.split("?")[1] if "?" in path_and_query else "")
    url_obj["raw"] = new_raw
    
    # Update the "path" array in the url object
    # split final_path by "/" and remove empty strings
    url_obj["path"] = [p for p in final_path.split("/") if p]

def process_item(item):
    if "item" in item:
        for sub_item in item["item"]:
            process_item(sub_item)
    elif "request" in item:
        req = item["request"]
        if "url" in req:
            if isinstance(req["url"], dict):
                update_url(req["url"])
            elif isinstance(req["url"], str):
                # Rare, but sometimes url is a string
                pass

for item in collection.get("item", []):
    process_item(item)

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(collection, f, indent=4)

print("Postman collection updated.")

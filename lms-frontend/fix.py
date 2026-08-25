import re

file_path = "src/app/services/common-http.service.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Revert whatever mess we created
# First revert LMA_BASE_URL/students back to LOCAL_API
content = content.replace("environment.LMS_BASE_URL}/students/students", "environment.LOCAL_API_BASE_URL}/students")
content = content.replace("environment.LMS_BASE_URL}/students/classes", "environment.LOCAL_API_BASE_URL}/classes")
content = content.replace("environment.LMS_BASE_URL}/students/enrollments", "environment.LOCAL_API_BASE_URL}/enrollments")

# Revert LOCAL_API_BASE_URL/students/classes back to LOCAL_API_BASE_URL/classes
content = content.replace("environment.LOCAL_API_BASE_URL}/students/classes", "environment.LOCAL_API_BASE_URL}/classes")
content = content.replace("environment.LOCAL_API_BASE_URL}/students/students", "environment.LOCAL_API_BASE_URL}/students")
content = content.replace("environment.LOCAL_API_BASE_URL}/students/enrollments", "environment.LOCAL_API_BASE_URL}/enrollments")

# Revert the member stuff
content = content.replace("environment.LOCAL_API_BASE_URL}/members/members", "environment.LOCAL_API_BASE_URL}/members")
content = content.replace("/members/roles", "/roles")
content = content.replace("environment.LOCAL_API_BASE_URL}/members/permissions", "environment.LOCAL_API_BASE_URL}/permissions")

# NOW do the clean replace
content = content.replace("environment.LOCAL_API_BASE_URL}/students", "environment.LMS_BASE_URL}/students/students")
content = content.replace("environment.LOCAL_API_BASE_URL}/classes", "environment.LMS_BASE_URL}/students/classes")
content = content.replace("environment.LOCAL_API_BASE_URL}/enrollments", "environment.LMS_BASE_URL}/students/enrollments")

content = content.replace("environment.LOCAL_API_BASE_URL}/members", "environment.LMS_BASE_URL}/members/members")
content = content.replace("environment.LOCAL_API_BASE_URL}/roles", "environment.LMS_BASE_URL}/members/roles")
content = content.replace("environment.LOCAL_API_BASE_URL}/permissions", "environment.LMS_BASE_URL}/members/permissions")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("done")

import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # check if it already has requirePaidWorkspaceAccess
    if 'requirePaidWorkspaceAccess' in content:
        return

    # Check if it's a webhooks file or public integration file
    if 'webhooks' in filepath or 'integrations' in filepath:
        return
        
    print(f"Patching {filepath}")

    # Add import
    import_statement = 'import { requirePaidWorkspaceAccess } from "@/lib/billing/entitlement";\n'
    if 'import { requirePaidWorkspaceAccess }' not in content:
        content = import_statement + content

    # Add check in exported methods
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    for method in methods:
        pattern = r'(export\s+async\s+function\s+' + method + r'\s*\([^)]*\)\s*\{)'
        replacement = r'\1\n  const accessError = await requirePaidWorkspaceAccess();\n  if (accessError) return accessError;\n'
        content = re.sub(pattern, replacement, content)

    with open(filepath, 'w') as f:
        f.write(content)

def main():
    api_dir = 'app/api'
    for root, dirs, files in os.walk(api_dir):
        for file in files:
            if file == 'route.ts':
                process_file(os.path.join(root, file))

if __name__ == '__main__':
    main()

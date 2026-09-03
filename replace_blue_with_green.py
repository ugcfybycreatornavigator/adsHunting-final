import os
import re

GREEN_RGB = "94,169,32"

def replace_in_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace common tailwind blue rgb values
    new_content = re.sub(r'37,\s*99,\s*235', GREEN_RGB, content)
    new_content = re.sub(r'59,\s*130,\s*246', GREEN_RGB, new_content)
    new_content = re.sub(r'29,\s*78,\s*216', GREEN_RGB, new_content)
    # Replace any text-blue-*, bg-blue-*, border-blue-*, ring-blue-*, shadow-blue-* 
    # to their green equivalents in these landing components
    new_content = re.sub(r'text-blue-(\d+)', r'text-brand', new_content)
    new_content = re.sub(r'bg-blue-(\d+)', r'bg-brand', new_content)
    new_content = re.sub(r'border-blue-(\d+)', r'border-brand', new_content)
    new_content = re.sub(r'ring-blue-(\d+)', r'ring-brand', new_content)
    new_content = re.sub(r'shadow-blue-(\d+)', r'shadow-brand', new_content)
    new_content = re.sub(r'from-blue-(\d+)', r'from-brand', new_content)
    new_content = re.sub(r'via-blue-(\d+)', r'via-brand', new_content)
    new_content = re.sub(r'to-blue-(\d+)', r'to-brand', new_content)
    
    # HeroOpticalBackground has a comment mentioning blue
    new_content = new_content.replace('BLUE LIGHT FIELD', 'GREEN LIGHT FIELD')
    new_content = new_content.replace('blue light fields', 'green light fields')
    new_content = new_content.replace('Blue light field', 'Green light field')
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('components/landing'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            replace_in_file(os.path.join(root, file))

for root, _, files in os.walk('app'):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.css')):
            replace_in_file(os.path.join(root, file))

# Also components folder
for root, _, files in os.walk('components'):
    for file in files:
        if file.endswith(('.tsx', '.ts')):
            replace_in_file(os.path.join(root, file))

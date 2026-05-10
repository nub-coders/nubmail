import os

def fix_use_client():
    for root, dirs, files in os.walk('src'):
        for file in files:
            if file.endswith('.tsx'):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                has_use_client = False
                use_client_idx = -1
                
                for i, line in enumerate(lines):
                    stripped = line.strip()
                    if stripped == '"use client";' or stripped == "'use client';" or stripped == '"use client"' or stripped == "'use client'":
                        has_use_client = True
                        use_client_idx = i
                        break
                        
                if has_use_client and use_client_idx > 0:
                    client_line = lines.pop(use_client_idx)
                    lines.insert(0, client_line)
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.writelines(lines)
                    print(f"Fixed {filepath}")

if __name__ == '__main__':
    fix_use_client()

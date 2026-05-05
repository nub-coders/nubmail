import os
import re

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if "localStorage.getItem('token')" not in content:
        return

    # Replace localStorage.getItem('token') with token
    content = content.replace("localStorage.getItem('token')", 'token')
    
    # Now ensure 'token' is extracted from useAuthClient()
    # The pattern is usually like: const { user, ... } = useAuthClient();
    # Let's find useAuthClient() calls and add token if it's missing.
    
    auth_client_pattern = r'(const\s+\{)([^}]+)(\}\s*=\s*useAuthClient\(\))'
    
    def replacer(match):
        pre = match.group(1)
        vars_str = match.group(2)
        post = match.group(3)
        
        # Split by comma to get individual vars
        vars_list = [v.strip() for v in vars_str.split(',')]
        
        # Check if 'token' is in the vars list (either directly or renamed, e.g., token: myToken)
        has_token = any(v == 'token' or v.startswith('token:') or v.startswith('token ') for v in vars_list)
        
        if not has_token:
            # Add token
            if vars_str.strip().endswith(','):
                new_vars = vars_str + ' token'
            else:
                new_vars = vars_str + ', token'
            return pre + new_vars + post
        else:
            return match.group(0)
            
    content = re.sub(auth_client_pattern, replacer, content)
    
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Fixed {filepath}')

for root, dirs, files in os.walk('src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            fix_file(os.path.join(root, file))

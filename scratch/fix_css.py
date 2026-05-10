import os
import re
import glob

def process_css_and_tsx():
    # Find all .module.css files
    css_files = glob.glob('src/**/*.module.css', recursive=True)
    
    for css_file in css_files:
        with open(css_file, 'r', encoding='utf-8') as f:
            css_content = f.read()
        
        # Find all class names in this file
        # Match .className, but not pseudo-classes that aren't preceded by our class
        # Just simple class names that are defined
        class_pattern = re.compile(r'\.([a-zA-Z_][a-zA-Z0-9_-]*)(?=[\s{:])')
        
        # we need to be careful not to prefix already prefixed classes or global classes
        # Actually, let's just prefix all defined classes in the module
        # But wait, there might be multiple occurrences.
        # Let's extract all unique class names defined in the file
        matches = class_pattern.findall(css_content)
        # Filter out classes that might not be definitions? We can just rename all `.xxx` to `.nu_xxx`
        # But wait, what if it's a global class? CSS modules don't usually have global classes unless wrapped in :global()
        # Let's just prefix all classes
        
        unique_classes = set(matches)
        
        if not unique_classes:
            continue
            
        # Only prefix if not already prefixed
        classes_to_prefix = [c for c in unique_classes if not c.startswith('nu_')]
        
        if not classes_to_prefix:
            continue
            
        new_css_content = css_content
        for c in sorted(classes_to_prefix, key=len, reverse=True):
            # Replace .className with .nu_className
            # We must be careful to only replace the class definition, or any usage in the CSS
            new_css_content = re.sub(r'\.' + re.escape(c) + r'(?=[^a-zA-Z0-9_-])', f'.nu_{c}', new_css_content)
            
        with open(css_file, 'w', encoding='utf-8') as f:
            f.write(new_css_content)
            
        # Now find the corresponding .tsx file(s)
        # Usually it's the same name but .tsx, or imported by other files.
        # It's safer to just search all .tsx files for `styles.c` or `styles['c']`
        # But doing it project-wide for all classes found might be slow or conflict.
        # Since it's a small project, it's fine.
        
        # Actually, it's better to process the specific .tsx file that imports this css
        dir_name = os.path.dirname(css_file)
        base_name = os.path.basename(css_file).replace('.module.css', '')
        
        # Find tsx files in the same directory
        tsx_files = glob.glob(f'{dir_name}/*.tsx')
        
        for tsx_file in tsx_files:
            with open(tsx_file, 'r', encoding='utf-8') as f:
                tsx_content = f.read()
                
            new_tsx_content = tsx_content
            for c in sorted(classes_to_prefix, key=len, reverse=True):
                # Replace styles.className
                new_tsx_content = re.sub(r'styles\.' + re.escape(c) + r'(?=[^a-zA-Z0-9_-])', f'styles.nu_{c}', new_tsx_content)
                # Replace styles['className']
                new_tsx_content = re.sub(r"styles\['" + re.escape(c) + r"'\]", f"styles['nu_{c}']", new_tsx_content)
                new_tsx_content = re.sub(r'styles\["' + re.escape(c) + r'"\]', f'styles["nu_{c}"]', new_tsx_content)
                
            if new_tsx_content != tsx_content:
                with open(tsx_file, 'w', encoding='utf-8') as f:
                    f.write(new_tsx_content)

if __name__ == '__main__':
    process_css_and_tsx()
    print("Done prefixing CSS modules.")

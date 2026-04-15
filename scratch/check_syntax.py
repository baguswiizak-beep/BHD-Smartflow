import sys

def check_braces(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract contents of <script> tag
    start_tag = '<script>'
    end_tag = '</script>'
    
    start_pos = content.find(start_tag)
    while start_pos != -1:
        end_pos = content.find(end_tag, start_pos)
        if end_pos == -1:
            print(f"Error: Missing {end_tag}")
            return
        
        script_content = content[start_pos + len(start_tag):end_pos]
        
        stack = []
        for i, char in enumerate(script_content):
            if char == '{':
                stack.append(('{', i))
            elif char == '}':
                if not stack:
                    print(f"Error: Unmatched '}}' at script index {i}")
                    # Print context
                    start = max(0, i-20)
                    end = min(len(script_content), i+20)
                    print(f"Context: ...{script_content[start:end]}...")
                    return
                stack.pop()
        
        if stack:
            char, i = stack.pop()
            print(f"Error: Unmatched '{{' at script index {i}")
            start = max(0, i-20)
            end = min(len(script_content), i+20)
            print(f"Context: ...{script_content[start:end]}...")
            return
        
        print("Done checking one script tag. No brace mismatch found.")
        start_pos = content.find(start_tag, end_pos)

if __name__ == "__main__":
    check_braces(sys.argv[1])

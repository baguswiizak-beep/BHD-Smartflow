import collections

with open(r'c:\Users\USER\Downloads\BHD\index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

counts = collections.Counter(text)
print(f"Open: {counts['{']}")
print(f"Close: {counts['}']}")
print(f"Diff: {counts['{'] - counts['}']}")

# Find where balance breaks
stack = []
for i, char in enumerate(text):
    if char == '{':
        stack.append(i)
    elif char == '}':
        if not stack:
            print(f"Excess closing brace at index {i}")
        else:
            stack.pop()

if stack:
    print(f"Unclosed braces at indices: {stack}")
    # Print context for the first unclosed brace
    start = max(0, stack[0] - 50)
    end = min(len(text), stack[0] + 100)
    print(f"Context for first unclosed brace:\n{text[start:end]}")

import sys
import os

filepath = r'c:\Users\USER\Downloads\BHD\index.html'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

output = []
in_conflict = False
current_block = [] # 0: upstream, 1: stashed

# Mode: kita ambil 'Stashed changes' (blok setelah =======) karena itu biasanya perubahan kita.
skip_block = False # True jika di 'Updated upstream'

for line in lines:
    if line.startswith('<<<<<<<'):
        in_conflict = True
        skip_block = True
        continue
    elif line.startswith('======='):
        skip_block = False
        continue
    elif line.startswith('>>>>>>>'):
        in_conflict = False
        continue
    
    if in_conflict:
        if not skip_block:
            output.append(line)
    else:
        output.append(line)

with open(filepath + '.cleaned', 'w', encoding='utf-8') as f:
    f.writelines(output)

print(f"File cleaned successfully. Output saved to {filepath}.cleaned")

$filepath = "c:\Users\USER\Downloads\BHD\index.html"
$content = Get-Content $filepath
$output = New-Object System.Collections.Generic.List[string]
$skip = $false

foreach ($line in $content) {
    if ($line -match '^<<<<<<<') {
        $skip = $true
        continue
    }
    if ($line -match '^=======') {
        $skip = $false
        continue
    }
    if ($line -match '^>>>>>>>') {
        continue
    }
    
    if (-not $skip) {
        $output.Add($line)
    }
}

$output | Set-Content ($filepath + ".cleaned") -Encoding UTF8

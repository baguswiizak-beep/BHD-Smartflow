$content = Get-Content 'c:\Users\USER\Downloads\BHD\index.html' -Raw
$scriptStart = $content.IndexOf('<script>')
$scriptEnd = $content.LastIndexOf('</script>')
$js = $content.Substring($scriptStart + 8, $scriptEnd - $scriptStart - 8)
Set-Content 'c:\Users\USER\Downloads\BHD\scratch\check_js.js' $js -Encoding UTF8
Write-Host "Extracted JS, lines: $(($js.Split("`n")).Length)"

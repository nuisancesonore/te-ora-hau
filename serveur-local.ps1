# Serveur web local pour Te Ora Hau — lance http://localhost:8000
# Ferme la fenêtre (ou Ctrl+C) pour arrêter.
$root = $PSScriptRoot
$prefix = "http://localhost:8000/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serveur demarre : $prefix" -ForegroundColor Green
Write-Host "Ouvre dans ton navigateur :  http://localhost:8000/index.html"
Write-Host "(laisse cette fenetre ouverte ; ferme-la pour arreter)"

$types = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
  ".js"="application/javascript; charset=utf-8"; ".json"="application/json";
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg";
  ".gif"="image/gif"; ".svg"="image/svg+xml"; ".ico"="image/x-icon";
  ".md"="text/plain; charset=utf-8"; ".sql"="text/plain; charset=utf-8"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrEmpty($rel)) { $rel = "index.html" }
    $path = Join-Path $root $rel
    if (Test-Path $path -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      if ($types.ContainsKey($ext)) { $ctx.Response.ContentType = $types[$ext] }
      # Empeche la mise en cache : les modifications s'affichent toujours
      $ctx.Response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
      $ctx.Response.Headers.Add("Pragma", "no-cache")
      $ctx.Response.Headers.Add("Expires", "0")
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - introuvable : $rel")
      $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
  } catch { }
}

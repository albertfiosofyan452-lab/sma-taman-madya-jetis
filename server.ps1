$ErrorActionPreference = 'Stop'
$webRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add('http://127.0.0.1:5501/')
$listener.Start()
Write-Host 'SMA Taman Madya berjalan di http://127.0.0.1:5501/'

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response
    $response.Headers.Add('Access-Control-Allow-Origin', '*')
    try {
        $path = $context.Request.Url.AbsolutePath
        if ($path -eq '/api/instagram') {
            $username = $context.Request.QueryString['username']
            if (-not $username) { $username = 'tamanmadyajetisyogya1956' }
            if ($username -notmatch '^[A-Za-z0-9._]+$') { throw 'Nama akun tidak valid.' }
            $encodedUsername = [Uri]::EscapeDataString($username)
            $apiUrl = "https://api-ig-ruddy.vercel.app/api/berita/sekolah/$encodedUsername"
            $apiResponse = Invoke-WebRequest -Uri $apiUrl -Headers @{ Accept = 'application/json'; 'User-Agent' = 'Mozilla/5.0' } -UseBasicParsing -TimeoutSec 30
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($apiResponse.Content)
            $response.ContentType = 'application/json; charset=utf-8'
            $response.StatusCode = [int]$apiResponse.StatusCode
        } elseif ($path -eq '/api/instagram-image') {
            $imageUrl = $context.Request.QueryString['url']
            $imageUri = $null
            if (-not [Uri]::TryCreate($imageUrl, [UriKind]::Absolute, [ref]$imageUri) -or $imageUri.Scheme -ne 'https') {
                throw 'URL gambar tidak valid.'
            }
            if ($imageUri.Host -ne 'cdninstagram.com' -and -not $imageUri.Host.EndsWith('.cdninstagram.com', [System.StringComparison]::OrdinalIgnoreCase)) {
                throw 'Host gambar tidak diizinkan.'
            }

            $imageRequest = [System.Net.HttpWebRequest]::Create($imageUri)
            $imageRequest.UserAgent = 'Mozilla/5.0'
            $imageResponse = $imageRequest.GetResponse()
            try {
                $memoryStream = [System.IO.MemoryStream]::new()
                $imageResponse.GetResponseStream().CopyTo($memoryStream)
                $bytes = $memoryStream.ToArray()
                $response.ContentType = $imageResponse.ContentType
                $memoryStream.Dispose()
            } finally {
                $imageResponse.Close()
            }
        } else {
            $relativePath = if ($path -eq '/') {
                'index.html'
            } else {
                [Uri]::UnescapeDataString($path.TrimStart('/'))
            }
            $rootPath = [System.IO.Path]::GetFullPath($webRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
            $filePath = [System.IO.Path]::GetFullPath((Join-Path $webRoot $relativePath))

            if (-not $filePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
                $response.StatusCode = 404
                $response.ContentType = 'text/plain; charset=utf-8'
                $bytes = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
            } else {
                $mimeTypes = @{
                    '.html' = 'text/html; charset=utf-8'
                    '.css' = 'text/css; charset=utf-8'
                    '.js' = 'application/javascript; charset=utf-8'
                    '.jpeg' = 'image/jpeg'
                    '.jpg' = 'image/jpeg'
                    '.png' = 'image/png'
                    '.webp' = 'image/webp'
                    '.svg' = 'image/svg+xml'
                    '.ico' = 'image/x-icon'
                }
                $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
                $response.ContentType = if ($mimeTypes.ContainsKey($extension)) { $mimeTypes[$extension] } else { 'application/octet-stream' }
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
            }
        }

        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
        $response.StatusCode = 502
        $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"error":"Permintaan layanan tidak dapat diproses"}')
        $response.ContentType = 'application/json; charset=utf-8'
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Warning $_.Exception.Message
    } finally {
        $response.Close()
    }
}
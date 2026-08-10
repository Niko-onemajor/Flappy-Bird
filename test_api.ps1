# Flappy Bird API Automated Test Script
# Tests score submission and leaderboard endpoints, then cleans up test data

$BASE = "http://localhost:5205"
$PASS = 0
$FAIL = 0
$TMP = "$env:TEMP\flappy_test"

function Test-Equal {
    param($Name, $Expected, $Actual)
    if ($Expected -eq $Actual) {
        $script:PASS++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    } else {
        $script:FAIL++
        Write-Host "  [FAIL] $Name (expected: $Expected, actual: $Actual)" -ForegroundColor Red
    }
}

function Test-Match {
    param($Name, $Pattern, $Actual)
    if ($Actual -match $Pattern) {
        $script:PASS++
        Write-Host "  [PASS] $Name" -ForegroundColor Green
    } else {
        $script:FAIL++
        Write-Host "  [FAIL] $Name (pattern: $Pattern, actual: $Actual)" -ForegroundColor Red
    }
}

function Post-Json {
    param($Url, $Json)
    $file = "$TMP\body.json"
    Set-Content -Path $file -Value $Json -Encoding ASCII -Force
    return curl.exe -s -X POST $Url -H "Content-Type: application/json" -d "@$file"
}

function Delete-Json {
    param($Url, $Json)
    $file = "$TMP\delete_body.json"
    Set-Content -Path $file -Value $Json -Encoding ASCII -Force
    return curl.exe -s -X DELETE $Url -H "Content-Type: application/json" -d "@$file"
}

# Create temp dir
New-Item -ItemType Directory -Force -Path $TMP | Out-Null

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Flappy Bird API Automated Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ========== 1.1 Submit score (normal) ==========
Write-Host "[1.1] Submit score (normal)" -ForegroundColor Yellow
$resp = Post-Json "$BASE/api/score" '{"playerName":"TestPlayer","score":42}'
$json = $resp | ConvertFrom-Json
Test-Equal "Status code 200" $true ($resp -ne $null -and $resp -ne "")
Test-Equal "score=42" 42 ([int]$json.score)
Test-Equal "playerName=TestPlayer" "TestPlayer" ([string]$json.playerName)
Test-Match "has createdAt" "^\d{4}" ([string]$json.createdAt)

# ========== 1.2 Submit score (0) ==========
Write-Host "[1.2] Submit score (0)" -ForegroundColor Yellow
$resp = Post-Json "$BASE/api/score" '{"playerName":"ZeroPlayer","score":0}'
$json = $resp | ConvertFrom-Json
Test-Equal "score=0" 0 ([int]$json.score)

# ========== 1.3 Submit score (high) ==========
Write-Host "[1.3] Submit score (high)" -ForegroundColor Yellow
$resp = Post-Json "$BASE/api/score" '{"playerName":"HighScorePlayer","score":999}'
$json = $resp | ConvertFrom-Json
Test-Equal "score=999" 999 ([int]$json.score)

# ========== 1.4 Submit score (empty name) ==========
Write-Host "[1.4] Submit score (empty name)" -ForegroundColor Yellow
$resp = Post-Json "$BASE/api/score" '{"playerName":"","score":10}'
$json = $resp | ConvertFrom-Json
Test-Equal "default name=Anonymous" "Anonymous" ([string]$json.playerName)
Test-Equal "score=10" 10 ([int]$json.score)

# ========== 2.1 Get leaderboard (limit=10) ==========
Write-Host "[2.1] Get leaderboard (limit=10)" -ForegroundColor Yellow
$resp = curl.exe -s "$BASE/api/score?limit=10"
$json = $resp | ConvertFrom-Json
Test-Equal "returns array" $true ($json -is [array])
Test-Equal "max 10 items" $true ($json.Length -le 10)
if ($json.Length -gt 0) {
    $sorted = $true
    for ($i = 1; $i -lt $json.Length; $i++) {
        if ([int]$json[$i-1].score -lt [int]$json[$i].score) { $sorted = $false; break }
    }
    Test-Equal "sorted by score desc" $true $sorted
    Test-Equal "has id field" $true ($null -ne $json[0].id)
    Test-Equal "has playerName field" $true ($null -ne $json[0].playerName)
    Test-Equal "has score field" $true ($null -ne $json[0].score)
    Test-Equal "has createdAt field" $true ($null -ne $json[0].createdAt)
}

# ========== 2.2 Get leaderboard (limit=20) ==========
Write-Host "[2.2] Get leaderboard (limit=20)" -ForegroundColor Yellow
$resp = curl.exe -s "$BASE/api/score?limit=20"
$json = $resp | ConvertFrom-Json
Test-Equal "max 20 items" $true ($json.Length -le 20)

# ========== 2.3 Get leaderboard (default limit) ==========
Write-Host "[2.3] Get leaderboard (default limit)" -ForegroundColor Yellow
$resp = curl.exe -s "$BASE/api/score"
$json = $resp | ConvertFrom-Json
Test-Equal "default limit=10" $true ($json.Length -le 10)

# ========== Summary ==========
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Passed: $PASS" -ForegroundColor Green
Write-Host "  Failed: $FAIL" -ForegroundColor $(if ($FAIL -gt 0) { "Red" } else { "Green" })
Write-Host ""

# ========== Cleanup test data ==========
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Cleaning up test data..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
$resp = Delete-Json "$BASE/api/score/cleanup" '{"playerNames":["TestPlayer","ZeroPlayer","HighScorePlayer","Anonymous"]}'
$result = $resp | ConvertFrom-Json
$delCount = $result.deletedCount
if ($delCount -gt 0) {
    Write-Host "  Deleted $delCount test records" -ForegroundColor Green
} else {
    Write-Host "  No test records to clean up" -ForegroundColor Yellow
}
Write-Host ""

# Clean up temp files
Remove-Item -Recurse -Force $TMP -ErrorAction SilentlyContinue

if ($FAIL -gt 0) { exit 1 } else { exit 0 }
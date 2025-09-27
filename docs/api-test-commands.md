# 🧪 CloudWalk Monitoring API - Test Commands
# =============================================

# 📊 Basic Statistics API
curl -X GET "http://localhost:3000/api/stats"

# 🚨 Recent Alerts API
curl -X GET "http://localhost:3000/api/alerts"

# 📈 Time Series Data (All available history)
curl -X GET "http://localhost:3000/api/timeseries"

# 📈 Time Series Data (Windowed by hours, relative to now)
curl -X GET "http://localhost:3000/api/timeseries?hours=1"   # 1 hour
curl -X GET "http://localhost:3000/api/timeseries?hours=6"   # 6 hours
curl -X GET "http://localhost:3000/api/timeseries?hours=24"  # 24 hours
curl -X GET "http://localhost:3000/api/timeseries?hours=720" # 30 days
curl -X GET "http://localhost:3000/api/timeseries?hours=4320" # 6 months

# 🛒 Checkout Analysis Data
curl -X GET "http://localhost:3000/api/checkout-analysis"

# 💳 Add New Transaction (POST)
curl -X POST "http://localhost:3000/api/transaction" \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2024-01-01T12:00:00Z","status":"approved","count":100}'

# 📊 Stats (All-time)
curl -X GET "http://localhost:3000/api/stats"

# 📊 Stats (Windowed by hours, relative to now)
curl -X GET "http://localhost:3000/api/stats?hours=1"   # 1 hour
curl -X GET "http://localhost:3000/api/stats?hours=6"   # 6 hours
curl -X GET "http://localhost:3000/api/stats?hours=24"  # 24 hours
curl -X GET "http://localhost:3000/api/stats?hours=720" # 30 days
curl -X GET "http://localhost:3000/api/stats?hours=4320" # 6 months

# ==================================================
# PowerShell Equivalents (if curl not available):
# ==================================================

# 📊 Basic Statistics API (PowerShell)
# Invoke-RestMethod -Uri "http://localhost:3000/api/stats" -Method GET

# 🚨 Recent Alerts API (PowerShell)
# Invoke-RestMethod -Uri "http://localhost:3000/api/alerts" -Method GET

# 📈 Time Series Data (PowerShell)
# Invoke-RestMethod -Uri "http://localhost:3000/api/timeseries" -Method GET | ConvertTo-Json -Depth 5
# Invoke-RestMethod -Uri "http://localhost:3000/api/timeseries?hours=24" -Method GET | ConvertTo-Json -Depth 5
# Invoke-RestMethod -Uri "http://localhost:3000/api/timeseries?hours=4320" -Method GET | ConvertTo-Json -Depth 5

# 🛒 Checkout Analysis Data (PowerShell)
# Invoke-RestMethod -Uri "http://localhost:3000/api/checkout-analysis" -Method GET

# 💳 Add New Transaction (PowerShell)
# $body = @{ timestamp = "2024-01-01T12:00:00Z"; status = "approved"; count = 100 } | ConvertTo-Json
# Invoke-RestMethod -Uri "http://localhost:3000/api/transaction" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 5

# 📊 Stats (PowerShell)
# Invoke-RestMethod -Uri "http://localhost:3000/api/stats" -Method GET | ConvertTo-Json -Depth 5
# Invoke-RestMethod -Uri "http://localhost:3000/api/stats?hours=24" -Method GET | ConvertTo-Json -Depth 5
# Invoke-RestMethod -Uri "http://localhost:3000/api/stats?hours=4320" -Method GET | ConvertTo-Json -Depth 5
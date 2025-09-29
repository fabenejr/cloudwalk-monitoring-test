# CloudWalk Monitoring System

## 📁 Organized Project Structure

```
cloudwalk-monitoring-test/
├── server.js                    # ⭐ Main server (USE THIS ONE)
├── package.json                 # Project configuration
├── data/                        # 📊 CSV Data
│   ├── transactions.csv
│   ├── transactions_auth_codes.csv
│   ├── checkout_1.csv
│   └── checkout_2.csv
├── public/                      # 🌐 Web Dashboard
│   └── index.html
├── analysis/                    # 📈 Data Analysis
│   └── dataAnalysis.js
├── tests/                       # 🧪 Tests
│   ├── api-tester.js
│   ├── quickTest.js
│   └── simpleTest.js
├── docs/                        # 📚 Documentation
│   ├── README.md
│   └── EXECUTION_SUMMARY.md
└── node_modules/                # Dependencies
```

## 🚀 How to Run

###Method 1: NPM Script (Recommended)
```bash
npm start
```

### Method 2: Direct Node
```bash
node server.js
```

### Method 3: Startup Script

```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

## 🧪 How to Test

```bash
# Test API
npm test

# Check server health
npm run health

# Run data analysis
npm run analyze
```

## 🌐 Access

- **Dashboard**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Stats**: http://localhost:3000/api/stats
- **WebSocket**: ws://localhost:8080

## 📊 Available APIs

- `GET /health` - Server status
- `GET /api/stats` -  Transaction statistics
- `GET /api/alerts` - Recent alerts
- `GET /api/checkout-analysis` - Checkout analysis
- `GET /api/timeseries` - Time series data
- `POST /api/transaction` - Submit transaction

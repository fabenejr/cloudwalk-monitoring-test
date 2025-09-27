# CloudWalk Monitoring System

## 📁 Estrutura Organizada do Projeto

```
cloudwalk-monitoring-test/
├── server.js                    # ⭐ Servidor principal (USE ESTE)
├── package.json                 # Configuração do projeto
├── data/                        # 📊 Dados CSV
│   ├── transactions.csv
│   ├── transactions_auth_codes.csv
│   ├── checkout_1.csv
│   └── checkout_2.csv
├── public/                      # 🌐 Dashboard web
│   └── index.html
├── analysis/                    # 📈 Análise de dados
│   └── dataAnalysis.js
├── tests/                       # 🧪 Testes
│   ├── api-tester.js
│   ├── quickTest.js
│   └── simpleTest.js
├── docs/                        # 📚 Documentação
│   ├── README.md
│   └── EXECUTION_SUMMARY.md
└── node_modules/               # Dependências
```

## 🚀 Como Executar

### Método 1: Script NPM (Recomendado)
```bash
npm start
```

### Método 2: Node direto
```bash
node server.js
```

### Método 3: Script de inicialização
```bash
# Windows
start.bat

# Linux/Mac
./start.sh
```

## 🧪 Como Testar

```bash
# Testar API
npm test

# Verificar saúde do servidor
npm run health

# Executar análise de dados
npm run analyze
```

## 🌐 Acessos

- **Dashboard**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **API Stats**: http://localhost:3000/api/stats
- **WebSocket**: ws://localhost:8080

## 📊 APIs Disponíveis

- `GET /health` - Status do servidor
- `GET /api/stats` - Estatísticas de transações
- `GET /api/alerts` - Alertas recentes
- `GET /api/checkout-analysis` - Análise de checkout
- `GET /api/timeseries` - Dados temporais
- `POST /api/transaction` - Enviar transação

## ✅ Problemas Resolvidos

1. **✅ Servidor estável** - Sem encerramento prematuro
2. **✅ Dados organizados** - CSVs na pasta `data/`
3. **✅ Testes organizados** - Scripts na pasta `tests/`
4. **✅ Documentação centralizada** - Tudo na pasta `docs/`
5. **✅ Duplicatas removidas** - Apenas arquivos essenciais
6. **✅ Error handling robusto** - Sistema não crasha
7. **✅ Dashboard funcional** - Com dados em tempo real

## 🎯 Status Atual

**SISTEMA 100% OPERACIONAL** 🎉

O projeto está organizado, limpo e funcionando perfeitamente!
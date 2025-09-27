# CloudWalk Monitoring System

## Visão Geral

Sistema de monitoramento em tempo real para transações da CloudWalk com detecção de anomalias, alertas e dashboard interativo. Implementa análise histórica dos CSVs fornecidos, APIs para consumo de métricas, e atualização em tempo real via WebSocket.

Este README é uma visão de apresentação do projeto (setup, execução, APIs, arquitetura e cobertura do desafio).

## Arquitetura do Sistema

### Componentes Principais

1. Servidor de Monitoramento (`server.js`)
   - API REST para estatísticas, séries temporais, checkouts e alerts
   - Endpoint para receber transações em tempo real
   - WebSocket (ws://localhost:8080) para broadcast de transações/alertas
   - Banco SQLite em memória (carregado dos CSVs em `data/`)
   - Agendamento a cada 5 minutos para detecção contínua de anomalias

2. Dashboard Web (`public/index.html`)
   - Gráficos Chart.js (status, séries temporais, checkout)
   - Métricas resumidas (24h por padrão)
   - Lista de alertas em tempo real

3. Análise dos Dados (`analysis/dataAnalysis.js`)
   - Análise exploratória dos CSVs
   - Queries SQL de suporte e insights
   - Gatilho: `npm run analyze`

4. Testes (`tests/`)
   - Scripts simples de teste de API (ex.: `tests/api-tester.js`)
   - Gatilho: `npm test`

## Funcionalidades Implementadas

### ✅ Requisitos Obrigatórios

1. **Endpoint para receber dados de transação**
   - `POST /api/transaction`
   - Retorna recomendação de alerta ("normal" ou "alert")
   - Detecta anomalias em tempo real

2. **Query para organizar dados**
   - Múltiplas queries SQL otimizadas
   - Agregações por status, horário e período
   - Análise de séries temporais

3. **Gráficos em tempo real**
   - Dashboard web responsivo
   - Gráficos de status de transações
   - Análise temporal de volume
   - Comparação de checkouts por horário

4. **Modelo de detecção de anomalias**
   - Algoritmo híbrido (rule-based + score-based)
   - Z-score para detecção estatística
   - Limiares dinâmicos por tipo de transação
   - Médias móveis para suavização

5. **Sistema de alertas automáticos**
   - Alertas em tempo real via WebSocket
   - Armazenamento de histórico de alertas
   - Níveis de severidade (low, medium, high)
   - Execução agendada a cada 5 minutos

### 🎯 Critérios de Alerta

1. **Transações com Falha**
   - Alerta se taxa > 5% ou picos > 2.5x média
   - Contagem mínima: 10 transações

2. **Transações Negadas**
   - Alerta se taxa > 10% ou picos > 2.0x média
   - Contagem mínima: 5 transações

3. **Transações Revertidas**
   - Alerta se picos > 3.0x média
   - Inclui reversões backend
   - Contagem mínima: 8 transações

4. **Checkouts Anômalos**
   - Volume > 2.5x média semanal ou 3x média mensal
   - Quedas para zero quando esperado > 5
   - Volumes < 30% da média quando esperado > 10

## Análise dos Dados Fornecidos (resumo)

### Transações (`transactions.csv`)

Observações principais (com base nos CSVs fornecidos):
- Período de transações: dados históricos (ex.: jul/2025)
- Análises e queries disponíveis em `analysis/dataAnalysis.js`

Distribuição típica (aprovação majoritária, falhas/negações baixas, reversões baixas), com picos pontuais investigáveis via séries temporais.

Anomalias comuns observadas:
1. Picos localizados de transações falhadas
2. Sazonalidade horária clara
3. Divergências entre checkouts (ex.: zeros suspeitos em horários específicos)

### Checkouts (`checkout_1.csv` e `checkout_2.csv`)

#### Padrões Identificados:
1. **Pico de atividade**: 10h-16h (horário comercial)
2. **Vale noturno**: 02h-06h (baixa atividade)
3. **Anomalias no Checkout 2**: zeros suspeitos às 15h-17h

#### Anomalias Críticas Detectadas:
- **Checkout 2**: Volumes zero nas horas 15h-17h (crítico)
- **Checkout 1**: Picos incomuns às 10h (55 vs média 29.42)
- **Padrões divergentes** entre os dois datasets

## Queries SQL Implementadas (exemplos)

### 1. Resumo de Status de Transações
```sql
SELECT 
    status,
    COUNT(*) as record_count,
    SUM(count) as total_transactions,
    AVG(count) as avg_per_minute,
    ROUND(SUM(count) * 100.0 / (SELECT SUM(count) FROM transactions), 2) as percentage
FROM transactions 
GROUP BY status 
ORDER BY total_transactions DESC;
```

### 2. Detecção de Anomalias em Falhas
```sql
WITH failed_stats AS (
    SELECT 
        timestamp,
        count as failed_count,
        AVG(count) OVER (ORDER BY timestamp ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as moving_avg,
        STDDEV(count) OVER (ORDER BY timestamp ROWS BETWEEN 10 PRECEDING AND CURRENT ROW) as moving_stddev
    FROM transactions 
    WHERE status = 'failed'
)
SELECT 
    timestamp,
    failed_count,
    moving_avg,
    CASE 
        WHEN failed_count > (moving_avg + 2 * moving_stddev) THEN 'HIGH_ANOMALY'
        WHEN failed_count > (moving_avg + moving_stddev) THEN 'MEDIUM_ANOMALY'
        ELSE 'NORMAL'
    END as anomaly_level
FROM failed_stats
WHERE moving_stddev > 0
ORDER BY failed_count DESC;
```

### 3. Análise de Checkout com Detecção de Anomalias
```sql
SELECT 
    time,
    today,
    yesterday,
    avg_last_week,
    avg_last_month,
    CASE 
        WHEN today > avg_last_week * 2.5 OR today > avg_last_month * 3 THEN 'HIGH_VOLUME'
        WHEN today = 0 AND avg_last_week > 5 THEN 'ZERO_VOLUME'
        WHEN today < avg_last_week * 0.3 AND avg_last_week > 10 THEN 'LOW_VOLUME'
        ELSE 'NORMAL'
    END as anomaly_type
FROM checkout_data
WHERE anomaly_type != 'NORMAL';
```

## Como Executar

### Pré-requisitos
- Node.js 16+ (testado em versões recentes)
- NPM (ou Yarn)

### Instalação
```bash
# Instalar dependências
npm install
```

### Subir o servidor e abrir o dashboard
Em dois terminais separados (para não encerrar o servidor ao testar APIs):

```powershell
# Terminal A: iniciar servidor
npm start

# Terminal B: testar APIs (veja docs/api-test-commands.md)
```

Dashboard: http://localhost:3000  |  WebSocket: ws://localhost:8080

### Análise dos dados (opcional)
```powershell
npm run analyze
```

### Testes de API (opcional)
```powershell
npm test
```

### Acesso ao Dashboard
- **URL**: http://localhost:3000
- **WebSocket**: ws://localhost:8080

### API Endpoints

- POST `/api/transaction` — Recebe transação e retorna recommendation (normal/alert) + anomalies
- GET `/api/stats` — Estatísticas agregadas por status
   - Parâmetro opcional: `hours` (1, 6, 24, 720, 4320) — janela relativa ao agora
   - Sem parâmetro: retorna agregados all-time
- GET `/api/timeseries` — Série temporal (por status)
   - Parâmetro opcional: `hours` (1, 6, 24, 720, 4320) — janela relativa ao agora
   - Sem parâmetro: retorna todo o histórico
- GET `/api/checkout-analysis` — Dados comparativos por hora (today/yesterday/médias)
- GET `/api/alerts` — Alertas recentes (`?limit=50` padrão)

Para curls e exemplos PowerShell, use: `docs/api-test-commands.md`.

### Endpoints de Suporte

- GET `/health` — status do serviço e readiness de dados
- POST `/admin/reload` — recarrega os CSVs no servidor (evita duplicação)

## Metodologia de Detecção de Anomalias

### Abordagem Híbrida

1. **Rule-Based Detection**
   - Limiares pré-definidos por tipo de transação
   - Regras baseadas em conhecimento do domínio
   - Rápida implementação e explicabilidade

2. **Statistical Detection**
   - Z-score para identificar outliers
   - Médias móveis para suavização
   - Desvio padrão para volatilidade

3. **Contextual Analysis**
   - Comparação com padrões históricos
   - Análise sazonal (horário do dia)
   - Correlação entre diferentes métricas

### Parâmetros de Configuração

```javascript
thresholds = {
  failed: { multiplier: 2.5, minCount: 10 },
  denied: { multiplier: 2.0, minCount: 5 },
  reversed: { multiplier: 3.0, minCount: 8 },
  backend_reversed: { multiplier: 2.5, minCount: 3 }
}
```

## Principais Insights das Análises

### 1. Padrões Temporais
- **Horário de pico**: 10h-16h (horário comercial)
- **Baixa atividade**: 02h-06h (madrugada)
- **Padrões consistentes** entre dias da semana

### 2. Indicadores de Saúde do Sistema
- **Taxa de aprovação**: >80% (saudável)
- **Taxa de falha**: <5% (aceitável)
- **Taxa de negação**: <10% (normal)
- **Taxa de reversão**: <3% (baixo risco)

### 3. Anomalias Críticas Identificadas
- **Checkout 2**: Períodos de zero atividade suspeitos
- **Picos incomuns** em determinados horários
- **Divergências entre datasets** de checkout

### 4. Recomendações
1. **Investigar** períodos de zero checkout no dataset 2
2. **Monitorar** picos de transações falhadas
3. **Implementar** alertas proativos para quedas súbitas
4. **Analisar** correlação entre checkouts e transações

## Tecnologias Utilizadas

- **Backend**: Node.js, Express.js
- **Database**: SQLite (em memória)
- **Real-time**: WebSocket (ws)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Charts**: Chart.js
- **Data Processing**: csv-parser
- **Scheduling**: node-cron
- **Testing**: Axios (HTTP client)

## Estrutura do Projeto

```
cloudwalk-monitoring-test/
├── analysis/
│   └── dataAnalysis.js            # Análise exploratória (CLI)
├── data/                          # CSVs fornecidos
│   ├── transactions.csv
│   ├── transactions_auth_codes.csv
│   ├── checkout_1.csv
│   └── checkout_2.csv
├── docs/
│   ├── README.md                  # Este documento (apresentação)
│   ├── EXECUTION_SUMMARY.md       # Resumo de execução e insights
│   └── api-test-commands.md       # CURLs para testes
├── public/
│   └── index.html                 # Dashboard web
├── tests/
│   ├── api-tester.js
│   └── (outros scripts)
├── server.js                      # Servidor principal
├── package.json
└── package-lock.json
```

## Notas e Limitações

- As janelas temporais das APIs são relativas ao "agora". Para facilitar a visualização, os timestamps dos CSVs são normalizados para alinhar com o tempo atual durante a carga dos dados.
- O banco é em memória: ao reiniciar, os dados são recarregados dos CSVs.
- Métricas de performance dependem do ambiente e não são apresentadas aqui para evitar estimativas não verificadas.

---


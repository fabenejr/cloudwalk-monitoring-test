// Script de teste para simular alertas e verificar notificações
const axios = require('axios');

async function testAlerts() {
    console.log('🧪 Testando sistema de alertas...\n');
    
    const baseURL = 'http://localhost:3000';
    
    // Teste 1: Transação com alto número de falhas (deve gerar alerta HIGH)
    console.log('1. Enviando transação com alto número de falhas...');
    const highFailureTransaction = {
        timestamp: new Date().toISOString(),
        status: 'failed',
        count: 150  // Alto número para disparar alerta
    };
    
    try {
        const response1 = await axios.post(`${baseURL}/api/transaction`, highFailureTransaction, {
            headers: { 'Content-Type': 'application/json' }
        });
        const result1 = response1.data;
        console.log('✅ Resposta:', result1.recommendation, '- Anomalias:', result1.anomalies?.length || 0);
    } catch (error) {
        console.error('❌ Erro no teste 1:', error.message);
    }
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste 2: Transação com número moderado de reversões (deve gerar alerta MEDIUM)
    console.log('\n2. Enviando transação com reversões moderadas...');
    const mediumReversalTransaction = {
        timestamp: new Date().toISOString(),
        status: 'reversed',
        count: 25
    };
    
    try {
        const response2 = await axios.post(`${baseURL}/api/transaction`, mediumReversalTransaction, {
            headers: { 'Content-Type': 'application/json' }
        });
        const result2 = response2.data;
        console.log('✅ Resposta:', result2.recommendation, '- Anomalias:', result2.anomalies?.length || 0);
    } catch (error) {
        console.error('❌ Erro no teste 2:', error.message);
    }
    
    // Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Teste 3: Transação normal (não deve gerar alerta)
    console.log('\n3. Enviando transação normal...');
    const normalTransaction = {
        timestamp: new Date().toISOString(),
        status: 'approved',
        count: 5
    };
    
    try {
        const response3 = await axios.post(`${baseURL}/api/transaction`, normalTransaction, {
            headers: { 'Content-Type': 'application/json' }
        });
        const result3 = response3.data;
        console.log('✅ Resposta:', result3.recommendation, '- Anomalias:', result3.anomalies?.length || 0);
    } catch (error) {
        console.error('❌ Erro no teste 3:', error.message);
    }
    
    // Verificar alertas gerados
    console.log('\n4. Verificando alertas gerados...');
    try {
        const alertsResponse = await axios.get(`${baseURL}/api/alerts?limit=5`);
        const alerts = alertsResponse.data;
        console.log(`✅ Total de alertas: ${alerts.length}`);
        alerts.forEach((alert, index) => {
            console.log(`   ${index + 1}. [${alert.severity.toUpperCase()}] ${alert.message}`);
        });
    } catch (error) {
        console.error('❌ Erro ao verificar alertas:', error.message);
    }
    
    console.log('\n🎉 Teste concluído! Verifique o dashboard em http://localhost:3000');
    console.log('💡 As notificações devem aparecer no canto superior direito da tela.');
    console.log('🔊 Alertas HIGH e MEDIUM devem emitir sons diferentes.');
}

// Executar apenas se o arquivo for chamado diretamente
if (require.main === module) {
    testAlerts().catch(console.error);
}

module.exports = { testAlerts };
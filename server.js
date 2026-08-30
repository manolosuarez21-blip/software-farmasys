const { loadEnvFile } = require('./src/utils/env');

// Cargar variables de entorno antes de importar modulos
loadEnvFile();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./src/config/db');

// Importar rutas
const authRoutes = require('./src/routes/auth');
const productRoutes = require('./src/routes/products');
const saleRoutes = require('./src/routes/sales');
const warehouseRoutes = require('./src/routes/warehouse');
const supplierRoutes = require('./src/routes/suppliers');
const userRoutes = require('./src/routes/users');
const reportRoutes = require('./src/routes/reports');

// Configurar Express
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Registrar rutas
app.use('/api', authRoutes);
app.use('/api/productos', productRoutes);
app.use('/api/ventas', saleRoutes);
app.use('/api/bodega', warehouseRoutes);
app.use('/api/distribuidores', supplierRoutes);
app.use('/api/usuarios', userRoutes);
app.use('/api/reportes', reportRoutes);

// Ruta fallback para servir el frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'farmasys.html'));
});

const os = require('os');

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

// Iniciar servidor
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIp();
      console.log('\n============================================================');
      console.log('  🚀 FARMAsys - Sistema de Gestión Farmacéutica en Ejecución');
      console.log('------------------------------------------------------------');
      console.log(`  💻 Acceso desde ESTE equipo:`);
      console.log(`     http://localhost:${PORT}`);
      console.log(`\n  📱 Acceso desde OTROS equipos (Mismo local / Red Wi-Fi - LAN):`);
      console.log(`     http://${localIp}:${PORT}`);
      console.log('============================================================\n');
    });
  } catch (error) {
    console.error('Error iniciando el servidor:', error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (require.main === module) {
  startServer();
}

module.exports = { initDb };
